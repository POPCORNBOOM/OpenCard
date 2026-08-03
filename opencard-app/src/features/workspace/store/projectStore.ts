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
import {
  PROJECT_PROFILE_FILE_NAME,
  parseProjectMetadataText,
  serializeProjectMetadata,
  toProjectInformation,
  type ProjectInformation,
  type ProjectProfile,
} from '../model/projectMetadata'
import {
  PROJECT_FONT_REGISTRY_FILE_NAME,
  parseProjectFontRegistryText,
  serializeProjectFontRegistry,
  type ProjectFontRegistry,
} from '../model/projectFontRegistry'
import {
  PROJECT_ICON_REGISTRY_FILE_NAME,
  parseProjectIconRegistryText,
  serializeProjectIconRegistry,
} from '../model/projectIconRegistry'
import {
  PROJECT_DICTIONARY_FILE_NAME,
  parseProjectDictionaryText,
  resolveProjectDictionary,
  serializeProjectDictionary,
  type ProjectDictionary,
  type ResolvedProjectDictionary,
} from '../model/projectDictionary'
import { useAppSettingsStore } from '../../settings/store/appSettingsStore'
import type { ProjectWorkspaceState } from '../../settings/model/appSettings'
import { taskScheduler } from '../../../utils/taskScheduler'
import type { OcTreeDropPosition } from '../../../shared/ui/tree/tree.types'
import { reportAppError } from '../../logging/appErrorCatalog'
import {
  clearProjectFonts,
  syncProjectFonts,
  type ProjectFontLoadError,
} from '../services/projectFontLoader'
import {
  buildProjectIconCatalog,
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
  type ProjectIconLoadError,
} from '../services/projectIconCatalog'
import {
  DEFAULT_PROJECT_ICON_DIRECTORY,
  findProjectIconKeyConflicts,
  normalizeProjectIconDirectory,
  type ProjectIconSeries,
} from '../model/projectIcons'
import {
  DEFAULT_PROJECT_FONT_DIRECTORY,
  normalizeProjectFontDirectory,
} from '../model/projectFonts'

const PROJECT_METADATA_SAVE_DELAY_MS = 1200
const PROJECT_METADATA_SAVE_KEY = 'project-metadata'
const PROJECT_TREE_LOOKAHEAD_DEPTH = 2
const PROJECT_FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf'])
const PROJECT_ICON_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

export type ImportedProjectFontFile = {
  source: string
  copied: boolean
}
export type ImportedProjectIconFile = ImportedProjectFontFile

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

export type WorkspaceEntryMoveRequest = {
  key: string
  targetKey: string | null
  position: OcTreeDropPosition
}

const projectPath = ref('')
const indexedEntries = ref<DirEntry[]>([])
const isWatching = ref(false)
const registeredDirectories = ref(new Map<string, number>())
const expandedDirectories = ref(new Set<string>())
const projectProfile = ref<ProjectProfile | null>(null)
const resolvedProject = ref<ProjectInformation | null>(null)
const profileError = ref<string | null>(null)
const projectFonts = ref<ProjectFontRegistry>({})
const fontRegistryError = ref<string | null>(null)
const projectFontLoadErrors = ref<readonly ProjectFontLoadError[]>([])
const projectIconSeries = ref<readonly ProjectIconSeries[]>([])
const iconRegistryError = ref<string | null>(null)
const projectIconCatalog = ref<ProjectIconCatalog>(EMPTY_PROJECT_ICON_CATALOG)
const projectIconLoadErrors = ref<readonly ProjectIconLoadError[]>([])
const projectDictionary = ref<ProjectDictionary | null>(null)
const resolvedDictionary = ref<ResolvedProjectDictionary | null>(null)
const dictionaryError = ref<string | null>(null)
const settingsStore = useAppSettingsStore()

let unlistenFn: UnlistenFn | null = null
let projectIconLoadVersion = 0

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function pathIdentity(path: string): string {
  const normalized = normalizePath(path)
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')
    ? normalized.toLocaleLowerCase()
    : normalized
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

  if (pathIdentity(normalizedPath) === pathIdentity(normalizedProjectPath)
    || pathIdentity(normalizedPath).startsWith(`${pathIdentity(normalizedProjectPath)}/`)) {
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

async function saveProjectWorkspaceState() {
  if (!projectPath.value) return
  const workspaceStates: Record<string, ProjectWorkspaceState> = Object.fromEntries(
    Object.entries(settingsStore.settings.value.projectCreation.workspaceStates)
    .map(([path, state]) => [path, {
      expandedDirectories: [...state.expandedDirectories],
      ...(state.projectProfile
        ? { projectProfile: { collapsedSections: [...state.projectProfile.collapsedSections] } }
        : {}),
    }]))
  const currentState = workspaceStates[normalizePath(projectPath.value)]
  workspaceStates[normalizePath(projectPath.value)] = {
    ...currentState,
    expandedDirectories: Array.from(expandedDirectories.value).sort(),
  }
  settingsStore.updateProjectCreation({ workspaceStates })
}

async function saveProjectConfiguration(path: string, content: string): Promise<string> {
  const profile = parseProjectMetadataText(content)
  if (!profile) throw new Error('Invalid .opencardprojectprofile content')
  const resolvedPath = resolveProjectPath(path)
  if (pathIdentity(resolvedPath) !== pathIdentity(resolveProjectPath(PROJECT_PROFILE_FILE_NAME))) {
    throw new Error('Project profile must be stored at the project root')
  }
  const canonicalContent = serializeProjectMetadata(profile)
  await fileSystemService.writeFile(resolvedPath, canonicalContent)
  await reloadProjectProfile()
  return canonicalContent
}

async function saveProjectFontRegistry(path: string, content: string): Promise<string> {
  const document = parseProjectFontRegistryText(content)
  if (!document) throw new Error('Invalid .fontreg content')
  const resolvedPath = resolveProjectPath(path)
  if (pathIdentity(resolvedPath) !== pathIdentity(resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME))) {
    throw new Error('Project font registry must be stored at the project root')
  }
  const canonicalContent = serializeProjectFontRegistry(document)
  await fileSystemService.writeFile(resolvedPath, canonicalContent)
  await reloadProjectFontRegistry()
  return canonicalContent
}

async function saveProjectIconRegistry(path: string, content: string): Promise<string> {
  const document = parseProjectIconRegistryText(content)
  if (!document || findProjectIconKeyConflicts(document.iconSeries).length > 0) {
    throw new Error('Invalid .iconreg content')
  }
  const resolvedPath = resolveProjectPath(path)
  if (pathIdentity(resolvedPath) !== pathIdentity(resolveProjectPath(PROJECT_ICON_REGISTRY_FILE_NAME))) {
    throw new Error('Project icon registry must be stored at the project root')
  }
  const canonicalContent = serializeProjectIconRegistry(document)
  await fileSystemService.writeFile(resolvedPath, canonicalContent)
  await reloadProjectIconRegistry()
  return canonicalContent
}

async function saveProjectDictionary(path: string, content: string): Promise<string> {
  const dictionary = parseProjectDictionaryText(content)
  if (!dictionary) throw new Error('Invalid .dictionary content')
  const resolvedPath = resolveProjectPath(path)
  if (pathIdentity(resolvedPath) !== pathIdentity(resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME))) {
    throw new Error('Project dictionary must be stored at the project root')
  }
  const canonicalContent = serializeProjectDictionary(dictionary)
  await fileSystemService.writeFile(resolvedPath, canonicalContent)
  await reloadProjectDictionary()
  return canonicalContent
}

function clearProjectProfile() {
  projectProfile.value = null
  resolvedProject.value = null
  profileError.value = null
}

function clearProjectFontRegistry() {
  clearProjectFonts()
  projectFonts.value = {}
  fontRegistryError.value = null
  projectFontLoadErrors.value = []
}

function clearProjectIconRegistry() {
  projectIconLoadVersion += 1
  projectIconSeries.value = []
  iconRegistryError.value = null
  projectIconCatalog.value = EMPTY_PROJECT_ICON_CATALOG
  projectIconLoadErrors.value = []
}

async function syncRegisteredProjectFonts(fonts: ProjectFontRegistry): Promise<void> {
  const result = await syncProjectFonts(fonts, resolveAssetSrc)
  if (result.current) projectFontLoadErrors.value = result.errors
}

async function syncRegisteredProjectIcons(iconSeries: readonly ProjectIconSeries[]): Promise<void> {
  const version = ++projectIconLoadVersion
  const catalog = await buildProjectIconCatalog(iconSeries, resolveAssetSrc)
  if (version !== projectIconLoadVersion) return
  projectIconCatalog.value = catalog
  projectIconLoadErrors.value = catalog.errors
}

function clearProjectDictionary() {
  projectDictionary.value = null
  resolvedDictionary.value = null
  dictionaryError.value = null
}

async function reloadProjectProfile(): Promise<boolean> {
  if (!projectPath.value) return false
  const path = resolveProjectPath(PROJECT_PROFILE_FILE_NAME)
  if (!await fileSystemService.fileExists(path)) {
    clearProjectProfile()
    return false
  }
  try {
    const profile = parseProjectMetadataText(await fileSystemService.readFile(path))
    if (!profile) throw new Error('Invalid project profile')
    projectProfile.value = profile
    resolvedProject.value = toProjectInformation(profile)
    profileError.value = null
    return true
  } catch (error) {
    profileError.value = error instanceof Error ? error.message : String(error)
    projectProfile.value = null
    resolvedProject.value = null
    reportAppError('OC-E3002', { path, error })
    return false
  }
}

async function reloadProjectFontRegistry(): Promise<boolean> {
  if (!projectPath.value) return false
  const path = resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME)
  if (!await fileSystemService.fileExists(path)) {
    clearProjectFontRegistry()
    return false
  }
  try {
    const document = parseProjectFontRegistryText(await fileSystemService.readFile(path))
    if (!document) throw new Error('Invalid project font registry')
    projectFonts.value = document.fonts ?? {}
    await syncRegisteredProjectFonts(projectFonts.value)
    fontRegistryError.value = null
    return true
  } catch (error) {
    clearProjectFontRegistry()
    fontRegistryError.value = error instanceof Error ? error.message : String(error)
    reportAppError('OC-E3009', { path, error })
    return false
  }
}

async function reloadProjectIconRegistry(): Promise<boolean> {
  if (!projectPath.value) return false
  const path = resolveProjectPath(PROJECT_ICON_REGISTRY_FILE_NAME)
  if (!await fileSystemService.fileExists(path)) {
    clearProjectIconRegistry()
    return false
  }
  try {
    const document = parseProjectIconRegistryText(await fileSystemService.readFile(path))
    if (!document || findProjectIconKeyConflicts(document.iconSeries).length > 0) {
      throw new Error('Invalid project icon registry')
    }
    projectIconSeries.value = document.iconSeries ?? []
    await syncRegisteredProjectIcons(projectIconSeries.value)
    iconRegistryError.value = null
    return true
  } catch (error) {
    clearProjectIconRegistry()
    iconRegistryError.value = error instanceof Error ? error.message : String(error)
    reportAppError('OC-E3010', { path, error })
    return false
  }
}

async function reloadProjectDictionary(): Promise<boolean> {
  if (!projectPath.value) return false
  const path = resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME)
  if (!await fileSystemService.fileExists(path)) {
    clearProjectDictionary()
    return false
  }
  try {
    const dictionary = parseProjectDictionaryText(await fileSystemService.readFile(path))
    if (!dictionary) throw new Error('Invalid project dictionary')
    const resolution = resolveProjectDictionary(dictionary)
    projectDictionary.value = dictionary
    resolvedDictionary.value = resolution.values
    dictionaryError.value = resolution.warning
    if (resolution.warning) {
      console.warn('[project-dictionary] Active language is missing:', { path, active: dictionary.active })
    }
    return true
  } catch (error) {
    dictionaryError.value = error instanceof Error ? error.message : String(error)
    projectDictionary.value = null
    resolvedDictionary.value = null
    reportAppError('OC-E3003', { path, error })
    return false
  }
}

function loadProjectWorkspaceState() {
  const identity = pathIdentity(projectPath.value)
  const entry = Object.entries(settingsStore.settings.value.projectCreation.workspaceStates)
    .find(([path]) => pathIdentity(path) === identity)
  expandedDirectories.value = new Set(entry?.[1].expandedDirectories ?? [])
  registeredDirectories.value = new Map([['', PROJECT_TREE_LOOKAHEAD_DEPTH]])
  for (const relativePath of expandedDirectories.value) {
    registeredDirectories.value.set(relativePath, PROJECT_TREE_LOOKAHEAD_DEPTH)
  }
}

function scheduleProjectMetadataSave() {
  if (!projectPath.value) return

  taskScheduler.schedule(PROJECT_METADATA_SAVE_KEY, PROJECT_METADATA_SAVE_DELAY_MS, async () => {
    await saveProjectWorkspaceState()
  })
}

function isMetadataPath(path: string): boolean {
  if (!projectPath.value) return false
  return [
    PROJECT_PROFILE_FILE_NAME,
    PROJECT_FONT_REGISTRY_FILE_NAME,
    PROJECT_ICON_REGISTRY_FILE_NAME,
    PROJECT_DICTIONARY_FILE_NAME,
  ]
    .some(fileName => pathIdentity(resolveProjectPath(fileName)) === pathIdentity(path))
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
        nextEntries.set(entry.name, entry)
      }
    }

    indexedEntries.value = Array.from(nextEntries.values())

    if (options?.persist !== false) {
      scheduleProjectMetadataSave()
    }
  } catch (error) {
    reportAppError('OC-E2005', error)
  }
}

async function readDirectoryEntries(path: string = '', depth: number = PROJECT_TREE_LOOKAHEAD_DEPTH) {
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
    registeredDirectories.value.set(
      relativePath,
      Math.max(registeredDirectories.value.get(relativePath) ?? 0, PROJECT_TREE_LOOKAHEAD_DEPTH),
    )
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
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_PROFILE_FILE_NAME)))) {
        void reloadProjectProfile()
      }
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME)))) {
        void reloadProjectFontRegistry()
      }
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_ICON_REGISTRY_FILE_NAME)))) {
        void reloadProjectIconRegistry()
      }
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME)))) {
        void reloadProjectDictionary()
      }
      const fontSources = Object.values(projectFonts.value)
        .map(definition => resolveProjectPath(definition.source))
      if (changedPaths.some(path => fontSources.some(source => pathIdentity(path) === pathIdentity(source)))) {
        void syncRegisteredProjectFonts(projectFonts.value)
      }
      const iconSources = projectIconSeries.value.map(series => resolveProjectPath(series.source))
      if (changedPaths.some(path => iconSources.some(source => pathIdentity(path) === pathIdentity(source)))) {
        void syncRegisteredProjectIcons(projectIconSeries.value)
      }
      void refreshIndexedEntries()
    })

    await fileSystemService.startWatching(projectPath.value)
    isWatching.value = true
  } catch (error) {
    reportAppError('OC-E2006', error)
  }
}

async function stopWatching() {
  taskScheduler.cancel(PROJECT_METADATA_SAVE_KEY)

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
    clearProjectProfile()
    clearProjectFontRegistry()
    clearProjectIconRegistry()
    clearProjectDictionary()

  if (!projectPath.value) {
    return
  }

  loadProjectWorkspaceState()
  await refreshIndexedEntries({ persist: false })
  await Promise.all([
    reloadProjectProfile(),
    reloadProjectFontRegistry(),
    reloadProjectIconRegistry(),
    reloadProjectDictionary(),
  ])
  await startWatching()
  scheduleProjectMetadataSave()
}

async function chooseProjectDirectory(): Promise<string | null> {
  const path = await fileSystemService.openProject()
  return path ? normalizePath(path) : null
}

async function openProject() {
  const path = await chooseProjectDirectory()
  if (path) {
    await setProjectPath(path)
  }

  return path
}

async function resetProjectWorkspaceState(): Promise<void> {
  if (!projectPath.value) return

  taskScheduler.cancel(PROJECT_METADATA_SAVE_KEY)
  registeredDirectories.value = new Map([['', PROJECT_TREE_LOOKAHEAD_DEPTH]])
  expandedDirectories.value = new Set()
  await refreshIndexedEntries({ persist: false })
  await saveProjectWorkspaceState()
}

async function readFile(path: string) {
  return await fileSystemService.readFile(resolveProjectPath(path))
}

async function isProjectAvailable(path: string): Promise<boolean> {
  const normalizedPath = normalizePath(path)
  if (!normalizedPath) return false
  return await fileSystemService.fileExists(normalizedPath)
}

async function saveFile(relativePath: string, content: string) {
  await fileSystemService.writeFile(resolveProjectPath(relativePath), content)
  await refreshIndexedEntries()
}

async function createFolder(relativePath: string) {
  await fileSystemService.createDirectory(resolveProjectPath(relativePath))
  await refreshIndexedEntries()
}

async function createFile(relativePath: string, content: string = '') {
  await fileSystemService.writeFile(resolveProjectPath(relativePath), content)
  await refreshIndexedEntries()
}

async function importProjectAssetFile(
  sourcePath: string,
  targetDirectoryPath: string,
  supportedExtensions: ReadonlySet<string>,
  unsupportedMessage: string,
): Promise<ImportedProjectFontFile> {
  const normalizedSourcePath = normalizePath(sourcePath)
  const projectRoot = ensureProjectOpen()
  const fileName = getPathBasename(normalizedSourcePath)
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLocaleLowerCase() : ''
  if (!supportedExtensions.has(extension)) throw new Error(unsupportedMessage)

  const sourceIdentity = pathIdentity(normalizedSourcePath)
  const projectIdentity = pathIdentity(projectRoot)
  if (sourceIdentity.startsWith(`${projectIdentity}/`)) {
    return {
      source: normalizedSourcePath.slice(projectRoot.length + 1),
      copied: false,
    }
  }

  const targetDirectory = resolveProjectPath(targetDirectoryPath)
  await fileSystemService.createDirectory(targetDirectory)
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const suffix = dotIndex > 0 ? fileName.slice(dotIndex) : ''
  let candidateName = fileName
  let candidateIndex = 2
  while (await fileSystemService.fileExists(`${targetDirectory}/${candidateName}`)) {
    candidateName = `${stem} ${candidateIndex}${suffix}`
    candidateIndex += 1
  }

  await fileSystemService.copyFile(normalizedSourcePath, `${targetDirectory}/${candidateName}`)
  await refreshIndexedEntries()
  return {
    source: `${targetDirectoryPath}/${candidateName}`,
    copied: true,
  }
}

async function importProjectFontFile(
  sourcePath: string,
  targetDirectoryPath = DEFAULT_PROJECT_FONT_DIRECTORY,
): Promise<ImportedProjectFontFile> {
  const targetDirectory = normalizeProjectFontDirectory(targetDirectoryPath)
  if (!targetDirectory) throw new Error('Invalid project font directory')
  return await importProjectAssetFile(
    sourcePath,
    targetDirectory,
    PROJECT_FONT_EXTENSIONS,
    'Unsupported project font file',
  )
}

async function importProjectIconFile(
  sourcePath: string,
  targetDirectoryPath = DEFAULT_PROJECT_ICON_DIRECTORY,
): Promise<ImportedProjectIconFile> {
  const targetDirectory = normalizeProjectIconDirectory(targetDirectoryPath)
  if (!targetDirectory) throw new Error('Invalid project icon directory')
  return await importProjectAssetFile(
    sourcePath,
    targetDirectory,
    PROJECT_ICON_EXTENSIONS,
    'Unsupported project icon series image',
  )
}

async function createEntryWithAvailableName(
  parentPath: string,
  baseName: string,
  kind: 'file' | 'folder',
  content: string = '',
): Promise<string> {
  const resolvedParentPath = resolveProjectPath(parentPath)
  let suffix = 1

  while (true) {
    const dotIndex = kind === 'file' ? baseName.lastIndexOf('.') : -1
    const name = suffix === 1
      ? baseName
      : dotIndex > 0
        ? `${baseName.slice(0, dotIndex)} ${suffix}${baseName.slice(dotIndex)}`
        : `${baseName} ${suffix}`
    const candidatePath = `${resolvedParentPath}/${name}`
    if (!await fileSystemService.fileExists(candidatePath)) {
      if (kind === 'folder') await fileSystemService.createDirectory(candidatePath)
      else await fileSystemService.writeFile(candidatePath, content)
      await refreshIndexedEntries()
      return candidatePath
    }
    suffix += 1
  }
}

async function trashFile(relativePath: string) {
  const resolvedPath = resolveProjectPath(relativePath)
  await fileSystemService.trashFile(resolvedPath)
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_PROFILE_FILE_NAME))) clearProjectProfile()
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME))) clearProjectFontRegistry()
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_ICON_REGISTRY_FILE_NAME))) clearProjectIconRegistry()
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME))) clearProjectDictionary()
  await refreshIndexedEntries()
}

async function revealEntryInFileManager(path: string) {
  await fileSystemService.revealInFileManager(resolveProjectPath(path))
}

function getRelativeProjectPath(path: string) {
  return toRelativeProjectPath(path)
}

function getRelativeProjectPathIfInside(path: string): string | null {
  const normalizedPath = normalizePath(path)
  const projectRoot = ensureProjectOpen()
  const identity = pathIdentity(normalizedPath)
  const projectIdentity = pathIdentity(projectRoot)
  if (identity === projectIdentity) return ''
  return identity.startsWith(`${projectIdentity}/`)
    ? normalizedPath.slice(projectRoot.length + 1)
    : null
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
  const normalizedTargetPath = pathIdentity(targetPath)
  const normalizedAncestorPath = pathIdentity(ancestorPath)
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

function resolveFileTreeDestination({ key, targetKey, position }: WorkspaceEntryMoveRequest) {
  if (!projectPath.value) {
    return null
  }

  const draggedPath = normalizePath(key)
  const targetPath = targetKey ? normalizePath(targetKey) : null
  const draggedEntry = indexedEntries.value.find((entry) =>
    normalizePath(resolveProjectPath(entry.name)) === draggedPath,
  )
  const targetEntry = targetPath
    ? indexedEntries.value.find((entry) => normalizePath(resolveProjectPath(entry.name)) === targetPath)
    : null
  if (
    !draggedEntry
    || targetPath && !targetEntry
    || !targetPath && position !== 'inside'
    || position === 'inside' && targetPath && !targetEntry?.isDirectory
  ) return null

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
    draggedIsDirectory: Boolean(draggedEntry.isDirectory),
    targetPath,
  }
}

function canMoveEntryByDrop(payload: WorkspaceEntryMoveRequest) {
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

  const normalizedSource = normalizePath(sourcePath)
  const normalizedTarget = normalizePath(targetPath)
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
  if (isMetadataPath(normalizedSource) || isMetadataPath(normalizedTarget)) {
    await Promise.all([
      reloadProjectProfile(),
      reloadProjectFontRegistry(),
      reloadProjectIconRegistry(),
      reloadProjectDictionary(),
    ])
  }
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
    reportAppError('OC-E2007', error)
    return { ok: false, reason: 'rename-failed' }
  }
}

async function moveEntryByDrop(payload: WorkspaceEntryMoveRequest): Promise<MoveEntryByDropResult> {
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
    reportAppError('OC-E2008', error)
    return { ok: false, reason: 'move-failed' }
  }
}

export function useProjectStore() {
  return {
    projectPath: readonly(projectPath),
    projectProfile: readonly(projectProfile),
    resolvedProject: readonly(resolvedProject),
    projectInformation: readonly(resolvedProject),
    profileError: readonly(profileError),
    projectFonts: readonly(projectFonts),
    fontRegistryError: readonly(fontRegistryError),
    projectFontLoadErrors: readonly(projectFontLoadErrors),
    projectIconSeries: readonly(projectIconSeries),
    iconRegistryError: readonly(iconRegistryError),
    projectIconCatalog: readonly(projectIconCatalog),
    projectIconLoadErrors: readonly(projectIconLoadErrors),
    projectDictionary: readonly(projectDictionary),
    resolvedDictionary: readonly(resolvedDictionary),
    dictionaryError: readonly(dictionaryError),
    projectName: computed(() => {
      if (!projectPath.value) return ''
      return projectPath.value.split('/').pop() || ''
    }),
    indexedEntries: readonly(indexedEntries),
    registeredDirectories: readonly(registeredDirectories),
    expandedDirectories: readonly(expandedDirectories),
    isWatching: readonly(isWatching),
    chooseProjectDirectory,
    openProject,
    resetProjectWorkspaceState,
    saveProjectConfiguration,
    saveProjectFontRegistry,
    saveProjectIconRegistry,
    saveProjectDictionary,
    reloadProjectProfile,
    reloadProjectFontRegistry,
    reloadProjectIconRegistry,
    reloadProjectDictionary,
    clearProjectProfile,
    clearProjectFontRegistry,
    clearProjectIconRegistry,
    clearProjectDictionary,
    setProjectPath,
    loadFiles,
    readDirectoryEntries,
    listProjectDirectoryEntries,
    setDirectoryExpanded,
    isDirectoryExpanded,
    resolveAssetSrc,
    readFile,
    isProjectAvailable,
    saveFile,
    createFolder,
    createFile,
    importProjectFontFile,
    importProjectIconFile,
    createEntryWithAvailableName,
    trashFile,
    revealEntryInFileManager,
    getRelativeProjectPath,
    getRelativeProjectPathIfInside,
    canMoveEntryByDrop,
    moveEntry,
    moveEntryByDrop,
    renameEntry,
    startWatching,
    stopWatching,
    resolveProjectPath,
  }
}
