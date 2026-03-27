import { computed, readonly, ref } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { fileSystemService } from '../services/fileSystemService'
import { taskScheduler } from '../utils/taskScheduler'

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
    setDirectoryExpanded,
    isDirectoryExpanded,
    resolveAssetSrc,
    readFile,
    saveFile,
    createFolder,
    deleteFile,
    startWatching,
    stopWatching,
    resolveProjectPath,
  }
}
