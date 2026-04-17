/**
 * 模块说明：
 * - 维护项目路径 目录索引 监听与文件树移动重命名事务
 * 职责边界：
 * - 只管理文件系统真相 不管理编辑草稿与会话状态
 */
import { computed, readonly, ref } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { fileSystemService } from '../services/fileSystemService'
import { taskScheduler } from '../../../utils/taskScheduler'
import type { ITreeNode, NodeTreeAllowedDropPositions, NodeTreeCanDropPayload, NodeTreeDropPayload } from '../../../shared/ui/tree/tree.types'

const PROJECT_CACHE_FILE_NAME = '.opencard-cache'
const PROJECT_CACHE_SAVE_DELAY_MS = 1200
const PROJECT_CACHE_SAVE_KEY = 'project-cache'

type PersistedDirEntry = Pick<DirEntry, 'name' | 'isDirectory' | 'isFile' | 'isSymlink'>

interface ProjectMetadata {
  version: 1
  workspace: {
    indexedEntries: PersistedDirEntry[]
    expandedDirectories: string[]
  }
}

interface FileChangedPayload {
  kind: string
  paths: string[]
}

type MoveEntryByDropResult =
  | { ok: true; fromPath: string; toPath: string }
  | { ok: false; reason: 'project-not-open' | 'invalid-target' | 'self-target' | 'descendant-target' | 'same-path' | 'target-exists' | 'move-failed' }

type RenameEntryResult =
  | { ok: true; fromPath: string; toPath: string }
  | { ok: false; reason: 'project-not-open' | 'invalid-name' | 'same-path' | 'target-exists' | 'rename-failed' }

const projectPath = ref('')
const indexedEntries = ref<DirEntry[]>([])
const isWatching = ref(false)
const registeredDirectories = ref(new Map<string, number>())
const expandedDirectories = ref(new Set<string>())

let unlistenFn: UnlistenFn | null = null

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function ensureProjectOpen(): string {
  if (!projectPath.value) {
    throw new Error('Project is not open')
  }

  return normalizePath(projectPath.value)
}

function resolveProjectPath(path: string): string {
  if (!path) {
    return ensureProjectOpen()
  }

  const normalizedProjectPath = ensureProjectOpen()
  const normalizedPath = normalizePath(path)

  if (normalizedPath === normalizedProjectPath || normalizedPath.startsWith(`${normalizedProjectPath}/`)) {
    return normalizedPath
  }

  return `${normalizedProjectPath}/${path.replace(/^[/\\]+/, '').replace(/\\/g, '/')}`
}

function toRelativeProjectPath(path: string): string {
  const normalizedProjectPath = ensureProjectOpen()
  const resolvedPath = resolveProjectPath(path)

  if (resolvedPath === normalizedProjectPath) {
    return ''
  }

  return resolvedPath.slice(normalizedProjectPath.length + 1)
}

function getMetadataPath(): string {
  return resolveProjectPath(PROJECT_CACHE_FILE_NAME)
}

function createProjectMetadata(): ProjectMetadata {
  return {
    version: 1,
    workspace: {
      indexedEntries: indexedEntries.value.map((entry) => ({
        name: entry.name,
        isDirectory: entry.isDirectory,
        isFile: entry.isFile,
        isSymlink: entry.isSymlink,
      })),
      expandedDirectories: Array.from(expandedDirectories.value).sort(),
    },
  }
}

function applyProjectMetadata(metadata: ProjectMetadata) {
  const nextExpandedDirectories = new Set(
    metadata.workspace.expandedDirectories
      .map((path) => normalizePath(path))
      .filter((path) => path.length > 0)
  )

  expandedDirectories.value = nextExpandedDirectories

  const nextRegisteredDirectories = new Map<string, number>()
  nextRegisteredDirectories.set('', 1)

  for (const relativePath of nextExpandedDirectories) {
    nextRegisteredDirectories.set(relativePath, Math.max(nextRegisteredDirectories.get(relativePath) ?? 0, 1))
  }

  registeredDirectories.value = nextRegisteredDirectories
  indexedEntries.value = metadata.workspace.indexedEntries.map((entry) => ({
    name: entry.name,
    isDirectory: entry.isDirectory,
    isFile: entry.isFile,
    isSymlink: entry.isSymlink,
  }))
}

async function saveProjectMetadata() {
  if (!projectPath.value) return

  try {
    await fileSystemService.writeFile(
      getMetadataPath(),
      JSON.stringify(createProjectMetadata(), null, 2)
    )
  } catch (error) {
    console.error('保存 .opencard-cache 失败:', error)
  }
}

function scheduleProjectMetadataSave() {
  if (!projectPath.value) return

  taskScheduler.schedule(PROJECT_CACHE_SAVE_KEY, PROJECT_CACHE_SAVE_DELAY_MS, async () => {
    await saveProjectMetadata()
  })
}

async function loadProjectMetadata() {
  try {
    const metadataPath = getMetadataPath()
    const exists = await fileSystemService.fileExists(metadataPath)

    if (!exists) {
      registeredDirectories.value = new Map([['', 1]])
      expandedDirectories.value = new Set()
      indexedEntries.value = []
      return
    }

    const raw = await fileSystemService.readFile(metadataPath)
    const parsed = JSON.parse(raw) as ProjectMetadata

    if (parsed.version !== 1 || !parsed.workspace) {
      throw new Error('Unsupported .opencard-cache format')
    }

    applyProjectMetadata(parsed)
  } catch (error) {
    console.error('读取 .opencard-cache 失败:', error)
    registeredDirectories.value = new Map([['', 1]])
    expandedDirectories.value = new Set()
    indexedEntries.value = []
  }
}

function isMetadataPath(path: string): boolean {
  return normalizePath(path) === getMetadataPath()
}

async function refreshIndexedEntries(options?: { persist?: boolean }) {
  if (!projectPath.value) return

  try {
    const nextEntries = new Map<string, DirEntry>()
    const registrations = Array.from(registeredDirectories.value.entries())
      .sort(([leftPath], [rightPath]) => leftPath.length - rightPath.length)

    for (const [relativePath, depth] of registrations) {
      const directoryPath = relativePath ? resolveProjectPath(relativePath) : ensureProjectOpen()
      const entries = await fileSystemService.readDirectoryEntries(directoryPath, depth, relativePath)

      for (const entry of entries) {
        if (entry.name === PROJECT_CACHE_FILE_NAME) {
          continue
        }

        nextEntries.set(entry.name, entry)
      }
    }

    indexedEntries.value = Array.from(nextEntries.values())

    if (options?.persist !== false) {
      scheduleProjectMetadataSave()
    }
  } catch (error) {
    console.error('刷新目录索引失败:', error)
  }
}

async function readDirectoryEntries(path: string = '', depth: number = 1) {
  const relativePath = toRelativeProjectPath(path)
  const normalizedDepth = Number.isFinite(depth) ? Math.max(1, Math.floor(depth)) : Number.POSITIVE_INFINITY
  const currentDepth = registeredDirectories.value.get(relativePath) ?? 0

  if (currentDepth < normalizedDepth) {
    registeredDirectories.value.set(relativePath, normalizedDepth)
  }

  await refreshIndexedEntries()
}

async function listProjectDirectoryEntries(path: string = '') {
  const relativePath = toRelativeProjectPath(path)
  const directoryPath = relativePath ? resolveProjectPath(relativePath) : ensureProjectOpen()
  return await fileSystemService.readDirectoryEntries(directoryPath, 1, relativePath)
}

function setDirectoryExpanded(path: string, expanded: boolean) {
  const relativePath = toRelativeProjectPath(path)
  if (!relativePath) {
    return
  }

  const nextExpandedDirectories = new Set(expandedDirectories.value)

  if (expanded) {
    nextExpandedDirectories.add(relativePath)
    registeredDirectories.value.set(relativePath, Math.max(registeredDirectories.value.get(relativePath) ?? 0, 1))
  } else {
    nextExpandedDirectories.delete(relativePath)
  }

  expandedDirectories.value = nextExpandedDirectories
  scheduleProjectMetadataSave()
}

function isDirectoryExpanded(path: string): boolean {
  const relativePath = toRelativeProjectPath(path)
  return relativePath ? expandedDirectories.value.has(relativePath) : true
}

function resolveAssetSrc(path: string): string {
  if (!path) {
    return ''
  }

  return convertFileSrc(resolveProjectPath(path))
}

async function loadFiles() {
  await readDirectoryEntries('', Number.POSITIVE_INFINITY)
}

async function startWatching() {
  if (!projectPath.value || isWatching.value) return

  try {
    unlistenFn = await listen<FileChangedPayload>('file-changed', (event: Event<FileChangedPayload>) => {
      const changedPaths = event.payload.paths.map((path) => normalizePath(path))

      if (changedPaths.length > 0 && changedPaths.every((path) => isMetadataPath(path))) {
        return
      }

      void refreshIndexedEntries()
    })

    await fileSystemService.startWatching(projectPath.value)
    isWatching.value = true
  } catch (error) {
    console.error('启动监听失败:', error)
  }
}

async function stopWatching() {
  taskScheduler.cancel(PROJECT_CACHE_SAVE_KEY)

  if (unlistenFn) {
    unlistenFn()
    unlistenFn = null
  }

  await fileSystemService.stopWatching()
  isWatching.value = false
}

async function setProjectPath(path: string) {
  const normalizedPath = normalizePath(path)

  if (projectPath.value === normalizedPath) {
    return
  }

  if (isWatching.value) {
    await stopWatching()
  }

  projectPath.value = normalizedPath
  indexedEntries.value = []
  registeredDirectories.value = new Map()
  expandedDirectories.value = new Set()

  if (!projectPath.value) {
    return
  }

  await loadProjectMetadata()
  await refreshIndexedEntries({ persist: false })
  await startWatching()
  scheduleProjectMetadataSave()
}

async function openProject() {
  const path = await fileSystemService.openProject()
  if (path) {
    await setProjectPath(path)
  }

  return path
}

async function readFile(path: string) {
  return await fileSystemService.readFile(resolveProjectPath(path))
}

async function saveFile(relativePath: string, content: string) {
  await fileSystemService.writeFile(resolveProjectPath(relativePath), content)
}

async function createFolder(relativePath: string) {
  await fileSystemService.createDirectory(resolveProjectPath(relativePath))
  await refreshIndexedEntries()
}

async function deleteFile(relativePath: string) {
  await fileSystemService.deleteFile(resolveProjectPath(relativePath))
  await refreshIndexedEntries()
}

function getFileTreeAllowedDropPositions(target: ITreeNode | null) {
  if (!target) {
    return ['inside']
  }

  return target.metadata?.isDirectory ? ['inside'] : []
}

function getPathDirname(path: string) {
  const normalizedPath = normalizePath(path)
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  if (lastSlashIndex === -1) {
    return ''
  }

  return normalizedPath.slice(0, lastSlashIndex)
}

function getPathBasename(path: string) {
  const normalizedPath = normalizePath(path)
  const lastSlashIndex = normalizedPath.lastIndexOf('/')
  return lastSlashIndex === -1 ? normalizedPath : normalizedPath.slice(lastSlashIndex + 1)
}

function isSameOrDescendantPath(targetPath: string, ancestorPath: string) {
  const normalizedTargetPath = normalizePath(targetPath)
  const normalizedAncestorPath = normalizePath(ancestorPath)
  return normalizedTargetPath === normalizedAncestorPath || normalizedTargetPath.startsWith(`${normalizedAncestorPath}/`)
}

function isValidEntryName(name: string) {
  if (!name) {
    return false
  }

  if (name === '.' || name === '..') {
    return false
  }

  if (/[<>:"/\\|?*\u0000-\u001F]/.test(name)) {
    return false
  }

  if (/[. ]$/.test(name)) {
    return false
  }

  return !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i.test(name)
}

function resolveFileTreeDestination({ dragged, target, position }: NodeTreeCanDropPayload) {
  if (!projectPath.value) {
    return null
  }

  const targetAllowedDropPositions = getFileTreeAllowedDropPositions(target)
  if (!targetAllowedDropPositions.includes(position)) {
    return null
  }

  const draggedPath = normalizePath(dragged.key)
  const targetPath = target ? normalizePath(target.key) : null

  let destinationDirectory = normalizePath(projectPath.value)
  if (targetPath) {
    destinationDirectory = position === 'inside'
      ? targetPath
      : getPathDirname(targetPath) || normalizePath(projectPath.value)
  }

  return {
    draggedPath,
    destinationDirectory,
    destinationPath: `${destinationDirectory}/${getPathBasename(draggedPath)}`,
    draggedIsDirectory: Boolean(dragged.metadata?.isDirectory),
    targetPath,
  }
}

function canMoveEntryByDrop(payload: NodeTreeCanDropPayload) {
  const destination = resolveFileTreeDestination(payload)
  if (!destination) {
    return false
  }

  const { draggedPath, destinationDirectory, destinationPath, draggedIsDirectory, targetPath } = destination

  if (targetPath && draggedPath === targetPath) {
    return false
  }

  if (targetPath && isSameOrDescendantPath(targetPath, draggedPath)) {
    return false
  }

  if (draggedIsDirectory && isSameOrDescendantPath(destinationDirectory, draggedPath)) {
    return false
  }

  if (destinationPath === draggedPath) {
    return false
  }

  return true
}

function remapRelativePath(path: string, oldPrefix: string, newPrefix: string): string {
  if (path === oldPrefix) {
    return newPrefix
  }

  if (!path.startsWith(`${oldPrefix}/`)) {
    return path
  }

  return `${newPrefix}${path.slice(oldPrefix.length)}`
}

async function moveEntry(sourcePath: string, targetPath: string) {
  const sourceRelativePath = toRelativeProjectPath(sourcePath)
  const targetRelativePath = toRelativeProjectPath(targetPath)
  const sourceEntry = indexedEntries.value.find((entry) => entry.name === sourceRelativePath)

  await fileSystemService.renameFile(
    resolveProjectPath(sourceRelativePath),
    resolveProjectPath(targetRelativePath),
  )

  if (sourceEntry?.isDirectory) {
    const nextExpandedDirectories = new Set<string>()
    for (const relativePath of expandedDirectories.value) {
      nextExpandedDirectories.add(remapRelativePath(relativePath, sourceRelativePath, targetRelativePath))
    }
    expandedDirectories.value = nextExpandedDirectories

    const nextRegisteredDirectories = new Map<string, number>()
    for (const [relativePath, depth] of registeredDirectories.value.entries()) {
      nextRegisteredDirectories.set(
        remapRelativePath(relativePath, sourceRelativePath, targetRelativePath),
        depth,
      )
    }
    registeredDirectories.value = nextRegisteredDirectories
  }

  await refreshIndexedEntries()
}

async function renameEntry(path: string, nextName: string): Promise<RenameEntryResult> {
  if (!projectPath.value) {
    return { ok: false, reason: 'project-not-open' }
  }

  const sourcePath = normalizePath(path)
  const trimmedName = nextName.trim()
  if (!isValidEntryName(trimmedName)) {
    return { ok: false, reason: 'invalid-name' }
  }

  const targetDirectory = getPathDirname(sourcePath)
  const targetPath = `${targetDirectory}/${trimmedName}`
  if (targetPath === sourcePath) {
    return { ok: false, reason: 'same-path' }
  }

  const targetExists = await fileSystemService.fileExists(targetPath)
  if (targetExists) {
    return { ok: false, reason: 'target-exists' }
  }

  try {
    await moveEntry(sourcePath, targetPath)
    return {
      ok: true,
      fromPath: sourcePath,
      toPath: targetPath,
    }
  } catch (error) {
    console.error('重命名文件失败:', error)
    return { ok: false, reason: 'rename-failed' }
  }
}

async function moveEntryByDrop(payload: NodeTreeDropPayload): Promise<MoveEntryByDropResult> {
  if (!projectPath.value) {
    return { ok: false, reason: 'project-not-open' }
  }

  const destination = resolveFileTreeDestination(payload)
  if (!destination) {
    return { ok: false, reason: 'invalid-target' }
  }

  const { draggedPath, destinationDirectory, destinationPath, draggedIsDirectory, targetPath } = destination

  if (targetPath && draggedPath === targetPath) {
    return { ok: false, reason: 'self-target' }
  }

  if (targetPath && isSameOrDescendantPath(targetPath, draggedPath)) {
    return { ok: false, reason: 'descendant-target' }
  }

  if (draggedIsDirectory && isSameOrDescendantPath(destinationDirectory, draggedPath)) {
    return { ok: false, reason: 'descendant-target' }
  }

  if (destinationPath === draggedPath) {
    return { ok: false, reason: 'same-path' }
  }

  const targetExists = await fileSystemService.fileExists(destinationPath)
  if (targetExists) {
    return { ok: false, reason: 'target-exists' }
  }

  try {
    await moveEntry(draggedPath, destinationPath)
    return {
      ok: true,
      fromPath: draggedPath,
      toPath: destinationPath,
    }
  } catch (error) {
    console.error('移动文件失败:', error)
    return { ok: false, reason: 'move-failed' }
  }
}

export function useProjectStore() {
  return {
    projectPath: readonly(projectPath),
    projectName: computed(() => {
      if (!projectPath.value) return ''
      return projectPath.value.split('/').pop() || ''
    }),
    indexedEntries: readonly(indexedEntries),
    registeredDirectories: readonly(registeredDirectories),
    expandedDirectories: readonly(expandedDirectories),
    isWatching: readonly(isWatching),
    openProject,
    setProjectPath,
    loadFiles,
    readDirectoryEntries,
    listProjectDirectoryEntries,
    setDirectoryExpanded,
    isDirectoryExpanded,
    resolveAssetSrc,
    readFile,
    saveFile,
    createFolder,
    deleteFile,
    getFileTreeAllowedDropPositions: getFileTreeAllowedDropPositions as NodeTreeAllowedDropPositions,
    canMoveEntryByDrop,
    moveEntry,
    moveEntryByDrop,
    renameEntry,
    startWatching,
    stopWatching,
    resolveProjectPath,
  }
}
