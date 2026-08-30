/**
 * 模块说明：
 * - 维护项目路径 目录索引 监听与文件树移动重命名事务
 * 职责边界：
 * - 只管理文件系统真相 不管理编辑草稿与会话状态
 */
import { computed, readonly, ref, shallowRef } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import { listen, type Event, type UnlistenFn } from '@tauri-apps/api/event'
import type { DirEntry } from '@tauri-apps/plugin-fs'
import { fileSystemService } from '../services/fileSystemService'
import { initializeProjectStructure } from '../services/projectStructureService'
import {
  isProjectInternalRelativePath,
  PROJECT_INTERNAL_DIRECTORIES,
  PROJECT_INTERNAL_DIRECTORY_NAME,
  resolveProjectInternalRelativePath,
} from '../model/projectStructure'
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
  buildProjectFontRegistry,
  parseProjectFontRegistryText,
  serializeProjectFontRegistry,
  type ProjectFontComposition,
  type ProjectFont,
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
  ensureLoadableProjectFont,
  extractFontCollectionFaces,
} from '../services/trueTypeFontRepair'
import { readProjectFontCharacterSet } from '../services/projectFontCoverage'
import {
  buildProjectIconCatalog,
  EMPTY_PROJECT_ICON_CATALOG,
  type ProjectIconCatalog,
  type ProjectIconLoadError,
} from '../services/projectIconCatalog'
import type { CardRenderEnvironment } from '../../card-rendering/renderPipeline'
import { isRemoteResourceAllowed } from '../../editor-runtime/services/editorResource'
import { networkResourceManager } from '../../network-resources/store/networkResourceManager'
import {
  DEFAULT_PROJECT_ICON_DIRECTORY,
  findProjectIconKeyConflicts,
  normalizeProjectIconDirectory,
  type ProjectIconSeries,
} from '../model/projectIcons'
import {
  DEFAULT_PROJECT_FONT_DIRECTORY,
} from '../model/projectFonts'
import {
  installResourcePackage,
  uninstallResourcePackage,
  type ResourcePackageInstallResult,
} from '../services/resourcePackageInstaller'
import {
  createProjectResourceNamespace,
  loadProjectResourceEnvironment,
  type ProjectResourceEnvironment,
  type ProjectResourceEnvironmentIssue,
  type ProjectResourcePackageCatalog,
} from '../services/projectResourceEnvironment'

const PROJECT_METADATA_SAVE_DELAY_MS = 1200
const PROJECT_METADATA_SAVE_KEY = 'project-metadata'
const PROJECT_TREE_LOOKAHEAD_DEPTH = 2
const PROJECT_FONT_EXTENSIONS = new Set(['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'])
const PROJECT_ICON_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

export type ImportedProjectFontFile = {
  source: string
  copied: boolean
}
export type ImportedProjectFontFiles = {
  sources: readonly string[]
  copied: boolean
}
export type ImportedProjectIconFile = ImportedProjectFontFile
export type ImportedResourcePackage = ResourcePackageInstallResult
export type ProjectAssetImportConflict = {
  existingSource: string
  availableCopySource: string
}
export type ProjectAssetImportResolution = 'rename-copy' | 'use-existing'

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
const fileChangeRevision = ref(0)
const registeredDirectories = ref(new Map<string, number>())
const expandedDirectories = ref(new Set<string>())
const projectProfile = ref<ProjectProfile | null>(null)
const resolvedProject = ref<ProjectInformation | null>(null)
const profileError = ref<string | null>(null)
const projectFontFamilies = ref<readonly ProjectFont[]>([])
const projectFontCompositions = ref<readonly ProjectFontComposition[]>([])
const projectFonts = ref<ProjectFontRegistry>({})
const fontRegistryError = ref<string | null>(null)
const fontRegistryReady = ref(false)
const projectFontLoadErrors = ref<readonly ProjectFontLoadError[]>([])
const projectIconSeries = ref<readonly ProjectIconSeries[]>([])
const iconRegistryError = ref<string | null>(null)
const iconRegistryReady = ref(false)
const projectIconCatalog = ref<ProjectIconCatalog>(EMPTY_PROJECT_ICON_CATALOG)
const projectIconLoadErrors = ref<readonly ProjectIconLoadError[]>([])
const projectDictionary = ref<ProjectDictionary | null>(null)
const resolvedDictionary = ref<ResolvedProjectDictionary | null>(null)
const dictionaryError = ref<string | null>(null)
const projectResourcePackages = shallowRef<ProjectResourcePackageCatalog>(new Map())
const resourceEnvironmentSnapshot = shallowRef<ProjectResourceEnvironment | null>(null)
const projectResourceEnvironments = shallowRef<ReadonlyMap<string, ProjectResourceEnvironment>>(new Map())
const projectResourceEnvironmentIssues = shallowRef<readonly ProjectResourceEnvironmentIssue[]>([])
let resourceEnvironmentReloadVersion = 0
const settingsStore = useAppSettingsStore()
const projectResourceEnvironment = computed<ProjectResourceEnvironment>(() => ({
  kind: 'project',
  namespace: createProjectResourceNamespace('project', projectPath.value || 'root'),
  rootPath: projectPath.value || null,
  generation: fileChangeRevision.value,
  fontDocument: {
    families: projectFontFamilies.value,
    compositions: projectFontCompositions.value,
  },
  fonts: projectFonts.value,
  iconDocument: { iconSeries: projectIconSeries.value },
  iconCatalog: projectIconCatalog.value,
  packages: projectResourcePackages.value,
  packageManifest: resourceEnvironmentSnapshot.value?.packageManifest,
  packageDifferences: resourceEnvironmentSnapshot.value?.packageDifferences,
  packageEnvironments: projectResourceEnvironments.value,
  issues: projectResourceEnvironmentIssues.value,
}))
const renderEnvironment = computed<CardRenderEnvironment>(() => ({
  project: resolvedProject.value,
  dictionary: resolvedDictionary.value,
  remoteResourcePolicy: projectProfile.value?.remoteResources,
  resolveRemoteResource: url => {
    const path = projectPath.value
    if (!path || !isRemoteResourceAllowed(url, projectProfile.value?.remoteResources)) return null
    const resource = networkResourceManager.forProject(
      path,
      source => isRemoteResourceAllowed(source, projectProfile.value?.remoteResources),
    ).get(url)
    return resource ? convertFileSrc(resource.path) : null
  },
  projectIconCatalog: projectIconCatalog.value,
  projectResourceEnvironment: projectResourceEnvironment.value,
}) as CardRenderEnvironment)

let unlistenFn: UnlistenFn | null = null
let projectIconLoadVersion = 0
let projectManagementStructurePromise: Promise<void> | null = null

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function pathIdentity(path: string): string {
  const normalized = normalizePath(path)
  return /^[A-Za-z]:\//.test(normalized) || normalized.startsWith('//')
    ? normalized.toLowerCase()
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

function resolveProjectInternalPath(path = ''): string {
  return resolveProjectPath(resolveProjectInternalRelativePath(path))
}

function resolveProjectInternalAssetSrc(path: string): string {
  return convertFileSrc(resolveProjectInternalPath(path))
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
      ...(state.sidebar ? {
        sidebar: {
          collapsedLists: [...state.sidebar.collapsedLists],
          listWeights: { ...state.sidebar.listWeights },
        },
      } : {}),
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
  if (!profile) throw new Error('Invalid project.json content')
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
  if (!document) throw new Error('Invalid fonts.json content')
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
    throw new Error('Invalid icons.json content')
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
  if (!dictionary) throw new Error('Invalid locale.json content')
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
  projectFontFamilies.value = []
  projectFontCompositions.value = []
  projectFonts.value = {}
  fontRegistryError.value = null
  projectFontLoadErrors.value = []
  fontRegistryReady.value = false
}

function clearProjectIconRegistry() {
  projectIconLoadVersion += 1
  projectIconSeries.value = []
  iconRegistryError.value = null
  projectIconCatalog.value = EMPTY_PROJECT_ICON_CATALOG
  projectIconLoadErrors.value = []
  iconRegistryReady.value = false
}

async function syncRegisteredProjectFonts(
  fonts: readonly ProjectFont[],
  compositions: readonly ProjectFontComposition[] = projectFontCompositions.value,
): Promise<void> {
  const result = await syncProjectFonts(
    fonts,
    resolveProjectInternalAssetSrc,
    compositions,
    async source => readProjectFontCharacterSet(
      await fileSystemService.readBinaryFile(resolveProjectInternalPath(source)),
    ),
  )
  if (result.current) projectFontLoadErrors.value = result.errors
}

async function syncRegisteredProjectIcons(iconSeries: readonly ProjectIconSeries[]): Promise<void> {
  const version = ++projectIconLoadVersion
  const catalog = await buildProjectIconCatalog(iconSeries, resolveProjectInternalAssetSrc)
  if (version !== projectIconLoadVersion) return
  projectIconCatalog.value = catalog
  projectIconLoadErrors.value = catalog.errors
}

function clearProjectDictionary() {
  projectDictionary.value = null
  resolvedDictionary.value = null
  dictionaryError.value = null
}

async function reloadProjectResourceEnvironment(): Promise<boolean> {
  const expectedVersion = ++resourceEnvironmentReloadVersion
  const expectedProjectPath = projectPath.value
  if (!expectedProjectPath) {
    projectResourcePackages.value = new Map()
    resourceEnvironmentSnapshot.value = null
    projectResourceEnvironments.value = new Map()
    projectResourceEnvironmentIssues.value = []
    return false
  }
  try {
    const environment = await loadProjectResourceEnvironment({
      fs: fileSystemService,
      rootPath: expectedProjectPath,
      kind: 'project',
      identity: expectedProjectPath,
      generation: fileChangeRevision.value,
    })
    if (expectedVersion !== resourceEnvironmentReloadVersion || expectedProjectPath !== projectPath.value) return false
    projectResourcePackages.value = environment.packages ?? new Map()
    resourceEnvironmentSnapshot.value = environment
    projectResourceEnvironments.value = environment.packageEnvironments ?? new Map()
    projectResourceEnvironmentIssues.value = environment.issues
    return true
  } catch (error) {
    if (expectedVersion !== resourceEnvironmentReloadVersion || expectedProjectPath !== projectPath.value) return false
    projectResourcePackages.value = new Map()
    resourceEnvironmentSnapshot.value = null
    projectResourceEnvironments.value = new Map()
    projectResourceEnvironmentIssues.value = [{ resource: 'packages', path: `${expectedProjectPath}/.opencard/packages`, message: error instanceof Error ? error.message : String(error) }]
    reportAppError('OC-E3011', { path: `${expectedProjectPath}/.opencard/packages`, error })
    return false
  }
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
    fontRegistryReady.value = true
    return false
  }
  try {
    const document = parseProjectFontRegistryText(await fileSystemService.readFile(path))
    if (!document) throw new Error('Invalid project font registry')
    projectFontFamilies.value = document.families ?? []
    projectFontCompositions.value = document.compositions ?? []
    projectFonts.value = buildProjectFontRegistry(document)
    await syncRegisteredProjectFonts(projectFontFamilies.value, projectFontCompositions.value)
    fontRegistryError.value = null
    fontRegistryReady.value = true
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
    iconRegistryReady.value = true
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
    iconRegistryReady.value = true
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
  for (const directory of PROJECT_INTERNAL_DIRECTORIES) {
    registeredDirectories.value.set(directory, 1)
  }
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
    const unavailableDirectories = new Set<string>()
    const registrations = Array.from(registeredDirectories.value.entries())
      .sort(([leftPath], [rightPath]) => leftPath.length - rightPath.length)

    for (const [relativePath, depth] of registrations) {
      const directoryPath = relativePath ? resolveProjectPath(relativePath) : ensureProjectOpen()
      let entries: DirEntry[]
      try {
        entries = await fileSystemService.readDirectoryEntries(directoryPath, depth, relativePath)
      } catch (error) {
        if (!relativePath || await fileSystemService.fileExists(directoryPath)) throw error
        unavailableDirectories.add(relativePath)
        continue
      }

      for (const entry of entries) {
        nextEntries.set(entry.name, entry)
      }
    }

    if (unavailableDirectories.size > 0) {
      registeredDirectories.value = new Map([...registeredDirectories.value]
        .filter(([relativePath]) => !unavailableDirectories.has(relativePath)))
      expandedDirectories.value = new Set([...expandedDirectories.value]
        .filter(relativePath => !unavailableDirectories.has(relativePath)))
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
      fileChangeRevision.value += 1
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_PROFILE_FILE_NAME)))) {
        void reloadProjectProfile()
      }
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME)))) {
        void reloadProjectFontRegistry()
      }
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_ICON_REGISTRY_FILE_NAME)))) {
        void reloadProjectIconRegistry()
      }
      void reloadProjectResourceEnvironment()
      if (changedPaths.some(path => pathIdentity(path) === pathIdentity(resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME)))) {
        void reloadProjectDictionary()
      }
      const fontSources = projectFontFamilies.value.flatMap(font => Object.values(font.files)
        .flatMap(styles => Object.values(styles ?? {}))
        .map(source => resolveProjectInternalPath(source)))
      if (changedPaths.some(path => fontSources.some(source => pathIdentity(path) === pathIdentity(source)))) {
        void syncRegisteredProjectFonts(projectFontFamilies.value)
      }
      const iconSources = projectIconSeries.value.map(series => resolveProjectInternalPath(series.source))
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
  projectManagementStructurePromise = null
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
    reloadProjectResourceEnvironment(),
  ])
  await startWatching()
  if (await fileSystemService.fileExists(resolveProjectPath(PROJECT_INTERNAL_DIRECTORY_NAME))) {
    void ensureProjectManagementStructure()
  }
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
  if (isProjectInternalRelativePath(toRelativeProjectPath(relativePath))) {
    throw new Error('Managed project directories cannot be created through ordinary file operations')
  }
  await fileSystemService.createDirectory(resolveProjectPath(relativePath))
  await refreshIndexedEntries()
}

async function createFile(relativePath: string, content: string = '') {
  if (isProjectInternalRelativePath(toRelativeProjectPath(relativePath))) {
    throw new Error('Managed project files cannot be created through ordinary file operations')
  }
  await fileSystemService.writeFile(resolveProjectPath(relativePath), content)
  await refreshIndexedEntries()
}

async function importProjectAssetFile(
  sourcePath: string,
  targetDirectoryPath: string,
  supportedExtensions: ReadonlySet<string>,
  unsupportedMessage: string,
  conflictResolution?: ProjectAssetImportResolution,
): Promise<ImportedProjectFontFile> {
  const normalizedSourcePath = normalizePath(sourcePath)
  ensureProjectOpen()
  const fileName = getPathBasename(normalizedSourcePath)
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLocaleLowerCase() : ''
  if (!supportedExtensions.has(extension)) throw new Error(unsupportedMessage)

  const sourceIdentity = pathIdentity(normalizedSourcePath)
  const targetDirectory = resolveProjectInternalPath(targetDirectoryPath)
  const targetIdentity = pathIdentity(targetDirectory)
  if (sourceIdentity.startsWith(`${targetIdentity}/`)) {
    return {
      source: `${targetDirectoryPath}/${normalizedSourcePath.slice(targetDirectory.length + 1)}`,
      copied: false,
    }
  }

  let candidateName = fileName
  const targetExists = await fileSystemService.fileExists(`${targetDirectory}/${fileName}`)
  if (targetExists && conflictResolution === 'use-existing') {
    return { source: `${targetDirectoryPath}/${fileName}`, copied: false }
  }
  if (!targetExists && conflictResolution === 'use-existing') {
    throw new Error('The selected existing project asset is no longer available')
  }
  if (targetExists) candidateName = await findAvailableProjectAssetName(targetDirectory, fileName)

  await fileSystemService.createDirectory(targetDirectory)
  await fileSystemService.copyFile(normalizedSourcePath, `${targetDirectory}/${candidateName}`)
  await refreshIndexedEntries()
  return {
    source: `${targetDirectoryPath}/${candidateName}`,
    copied: true,
  }
}

async function findAvailableProjectAssetName(targetDirectory: string, fileName: string): Promise<string> {
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  const suffix = dotIndex > 0 ? fileName.slice(dotIndex) : ''
  let candidateIndex = 2
  while (await fileSystemService.fileExists(`${targetDirectory}/${stem} (${candidateIndex})${suffix}`)) {
    candidateIndex += 1
  }
  return `${stem} (${candidateIndex})${suffix}`
}

async function getProjectAssetImportConflict(
  sourcePath: string,
  targetDirectoryPath: string,
  supportedExtensions: ReadonlySet<string>,
  unsupportedMessage: string,
): Promise<ProjectAssetImportConflict | null> {
  const normalizedSourcePath = normalizePath(sourcePath)
  ensureProjectOpen()
  const fileName = getPathBasename(normalizedSourcePath)
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLocaleLowerCase() : ''
  if (!supportedExtensions.has(extension)) throw new Error(unsupportedMessage)
  const targetDirectory = resolveProjectInternalPath(targetDirectoryPath)
  if (pathIdentity(normalizedSourcePath).startsWith(`${pathIdentity(targetDirectory)}/`)) return null

  if (!await fileSystemService.fileExists(`${targetDirectory}/${fileName}`)) return null
  const availableName = await findAvailableProjectAssetName(targetDirectory, fileName)
  return {
    existingSource: `${targetDirectoryPath}/${fileName}`,
    availableCopySource: `${targetDirectoryPath}/${availableName}`,
  }
}

async function importProjectFontFiles(
  sourcePath: string,
  conflictResolution?: ProjectAssetImportResolution,
  collectionIndices?: readonly number[],
): Promise<ImportedProjectFontFiles> {
  const targetDirectory = DEFAULT_PROJECT_FONT_DIRECTORY
  const normalizedSourcePath = normalizePath(sourcePath)
  ensureProjectOpen()
  const fileName = getPathBasename(normalizedSourcePath)
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLocaleLowerCase() : ''
  if (!PROJECT_FONT_EXTENSIONS.has(extension)) throw new Error('Unsupported project font file')

  const sourceIdentity = pathIdentity(normalizedSourcePath)
  const targetAbsoluteDirectory = resolveProjectInternalPath(targetDirectory)
  const sourceInsideManagedDirectory = sourceIdentity.startsWith(`${pathIdentity(targetAbsoluteDirectory)}/`)
  const sourceBytes = await fileSystemService.readBinaryFile(normalizedSourcePath)
  if (extension === 'ttc' || extension === 'otc') {
    const faces = extractFontCollectionFaces(sourceBytes)
    const stem = fileName.slice(0, fileName.lastIndexOf('.'))
    const sources: string[] = []
    await fileSystemService.createDirectory(targetAbsoluteDirectory)
    const selectedIndices = collectionIndices ?? faces.map((_, index) => index)
    for (const index of selectedIndices) {
      if (!Number.isInteger(index) || index < 0 || index >= faces.length) {
        throw new Error('Invalid font collection member')
      }
      const face = faces[index]!
      const extractedName = `${stem}-${index + 1}.${face.extension}`
      const prepared = await ensureLoadableProjectFont(face.bytes, extractedName)
      const duplicateName = await findMatchingProjectFontFile(targetAbsoluteDirectory, prepared.bytes)
      if (duplicateName) {
        sources.push(`${targetDirectory}/${duplicateName}`)
        continue
      }
      const desiredName = prepared.repaired ? createRepairedFontName(extractedName) : extractedName
      const outputName = await fileSystemService.fileExists(`${targetAbsoluteDirectory}/${desiredName}`)
        ? await findAvailableProjectAssetName(targetAbsoluteDirectory, desiredName)
        : desiredName
      await fileSystemService.writeBinaryFile(`${targetAbsoluteDirectory}/${outputName}`, prepared.bytes)
      sources.push(`${targetDirectory}/${outputName}`)
    }
    await refreshIndexedEntries()
    return { sources, copied: true }
  }
  const targetExists = await fileSystemService.fileExists(`${targetAbsoluteDirectory}/${fileName}`)
  if (!sourceInsideManagedDirectory && targetExists && conflictResolution === 'use-existing') {
    return { sources: [`${targetDirectory}/${fileName}`], copied: false }
  }

  const prepared = await ensureLoadableProjectFont(
    sourceBytes,
    fileName,
  )
  const duplicateName = await findMatchingProjectFontFile(targetAbsoluteDirectory, prepared.bytes)
  if (duplicateName) return { sources: [`${targetDirectory}/${duplicateName}`], copied: false }
  if (sourceInsideManagedDirectory && !prepared.repaired) {
    return {
      sources: [`${targetDirectory}/${normalizedSourcePath.slice(targetAbsoluteDirectory.length + 1)}`],
      copied: false,
    }
  }

  const outputDirectory = targetAbsoluteDirectory
  const repairedName = prepared.repaired ? createRepairedFontName(fileName) : fileName
  const outputName = await fileSystemService.fileExists(`${outputDirectory}/${repairedName}`)
    ? await findAvailableProjectAssetName(outputDirectory, repairedName)
    : repairedName
  await fileSystemService.createDirectory(outputDirectory)
  if (prepared.repaired) await fileSystemService.writeBinaryFile(`${outputDirectory}/${outputName}`, prepared.bytes)
  else await fileSystemService.copyFile(normalizedSourcePath, `${outputDirectory}/${outputName}`)
  await refreshIndexedEntries()
  return { sources: [`${targetDirectory}/${outputName}`], copied: true }
}

async function ensureProjectManagementStructure(): Promise<void> {
  if (projectManagementStructurePromise) return await projectManagementStructurePromise
  const root = ensureProjectOpen()
  projectManagementStructurePromise = (async () => {
    await initializeProjectStructure(fileSystemService, root)
    for (const directory of PROJECT_INTERNAL_DIRECTORIES) {
      registeredDirectories.value.set(directory, 1)
    }
    if (projectPath.value !== root) return
    await refreshIndexedEntries({ persist: false })
  })()
  await projectManagementStructurePromise
}

async function findMatchingProjectFontFile(
  targetDirectory: string,
  bytes: Uint8Array,
): Promise<string | null> {
  let entries: DirEntry[]
  try {
    entries = await fileSystemService.readDirectoryEntries(targetDirectory, 1)
  } catch {
    return null
  }
  for (const entry of entries) {
    if (!entry.isFile || entry.isSymlink || !PROJECT_FONT_EXTENSIONS.has(
      entry.name.split('.').pop()?.toLocaleLowerCase() ?? '',
    )) continue
    try {
      const existing = await fileSystemService.readBinaryFile(`${targetDirectory}/${entry.name}`)
      if (existing.length === bytes.length && existing.every((byte, index) => byte === bytes[index])) {
        return entry.name
      }
    } catch {
      // An unreadable candidate does not make the import itself fail.
    }
  }
  return null
}

function createRepairedFontName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  const stem = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName
  return `${stem}-repaired.ttf`
}

async function getProjectFontImportConflict(
  sourcePath: string,
): Promise<ProjectAssetImportConflict | null> {
  const targetDirectory = DEFAULT_PROJECT_FONT_DIRECTORY
  if (/\.(?:ttc|otc)$/i.test(sourcePath)) return null
  return await getProjectAssetImportConflict(
    sourcePath,
    targetDirectory,
    PROJECT_FONT_EXTENSIONS,
    'Unsupported project font file',
  )
}

async function importProjectIconFile(
  sourcePath: string,
  targetDirectoryPath = DEFAULT_PROJECT_ICON_DIRECTORY,
  conflictResolution?: ProjectAssetImportResolution,
): Promise<ImportedProjectIconFile> {
  const targetDirectory = normalizeProjectIconDirectory(targetDirectoryPath)
  if (!targetDirectory) throw new Error('Invalid project icon directory')
  return await importProjectAssetFile(
    sourcePath,
    targetDirectory,
    PROJECT_ICON_EXTENSIONS,
    'Unsupported project icon image',
    conflictResolution,
  )
}

async function installResourcePackageFile(
  sourcePath: string,
  confirmReplacement?: Parameters<typeof installResourcePackage>[0]['confirmReplacement'],
 ): Promise<ImportedResourcePackage> {
  const installed = await installResourcePackage({
    fs: fileSystemService,
    projectRootPath: ensureProjectOpen(),
    sourcePath: normalizePath(sourcePath),
    confirmReplacement,
  })
  await reloadProjectResourceEnvironment()
  await refreshIndexedEntries()
  return installed
}

async function uninstallResourcePackageFile(
  packageKey: string,
  confirmRemoval?: Parameters<typeof uninstallResourcePackage>[0]['confirmRemoval'],
 ): Promise<boolean> {
  const key = packageKey.trim().toLocaleLowerCase()
  const packageEntry = projectResourcePackages.value.get(key)
  const removed = await uninstallResourcePackage({
    fs: fileSystemService,
    projectRootPath: ensureProjectOpen(),
    packageKey: key,
    manifest: packageEntry?.manifest ?? null,
    dependents: [...projectResourcePackages.value.values()].map(entry => entry.manifest),
    confirmRemoval,
  })
  if (!removed) return false
  await reloadProjectResourceEnvironment()
  await refreshIndexedEntries()
  return true
}

async function getProjectIconImportConflict(
  sourcePath: string,
  targetDirectoryPath = DEFAULT_PROJECT_ICON_DIRECTORY,
): Promise<ProjectAssetImportConflict | null> {
  const targetDirectory = normalizeProjectIconDirectory(targetDirectoryPath)
  if (!targetDirectory) throw new Error('Invalid project icon directory')
  return await getProjectAssetImportConflict(
    sourcePath,
    targetDirectory,
    PROJECT_ICON_EXTENSIONS,
    'Unsupported project icon image',
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
  if (isProjectInternalRelativePath(toRelativeProjectPath(relativePath))) {
    throw new Error('Managed project files cannot be moved to trash')
  }
  const resolvedPath = resolveProjectPath(relativePath)
  await fileSystemService.trashFile(resolvedPath)
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_PROFILE_FILE_NAME))) clearProjectProfile()
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_FONT_REGISTRY_FILE_NAME))) clearProjectFontRegistry()
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_ICON_REGISTRY_FILE_NAME))) clearProjectIconRegistry()
  if (pathIdentity(resolvedPath) === pathIdentity(resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME))) clearProjectDictionary()
  await refreshIndexedEntries()
}

async function trashUnusedProjectFontFiles(
  paths: readonly string[],
  registeredSources: readonly string[],
): Promise<void> {
  await trashUnusedProjectAssetFiles(
    paths,
    registeredSources,
    DEFAULT_PROJECT_FONT_DIRECTORY,
    PROJECT_FONT_EXTENSIONS,
    'font',
  )
}

async function trashUnusedProjectIconFiles(
  paths: readonly string[],
  registeredSources: readonly string[],
): Promise<void> {
  await trashUnusedProjectAssetFiles(
    paths,
    registeredSources,
    DEFAULT_PROJECT_ICON_DIRECTORY,
    PROJECT_ICON_EXTENSIONS,
    'icon',
  )
}

async function trashUnusedProjectAssetFiles(
  paths: readonly string[],
  registeredSources: readonly string[],
  directory: string,
  extensions: ReadonlySet<string>,
  assetKind: 'font' | 'icon',
): Promise<void> {
  const registered = new Set(registeredSources
    .map(source => normalizePath(source).replace(/^\/+/, '').toLocaleLowerCase()))
  const directoryPrefix = `${resolveProjectInternalRelativePath(directory)}/`
  const candidates = [...new Set(paths.map(path => normalizePath(toRelativeProjectPath(path))))]

  for (const relativePath of candidates) {
    const normalizedIdentity = relativePath.toLocaleLowerCase()
    if (relativePath.split('/').some(segment => segment === '.' || segment === '..')) {
      throw new Error(`Unsafe project ${assetKind} path`)
    }
    if (!normalizedIdentity.startsWith(directoryPrefix.toLocaleLowerCase())) {
      throw new Error(`Only managed project ${assetKind} files can be cleaned up`)
    }
    const source = relativePath.slice(`${PROJECT_INTERNAL_DIRECTORY_NAME}/`.length)
    const extension = source.split('.').pop()?.toLocaleLowerCase() ?? ''
    if (!extensions.has(extension)) throw new Error(`Unsupported project ${assetKind} file`)
    if (registered.has(source.toLocaleLowerCase())) throw new Error(`Project ${assetKind} file is still registered: ${source}`)
  }

  let changed = false
  try {
    for (const relativePath of candidates) {
      await fileSystemService.trashFile(resolveProjectPath(relativePath))
      changed = true
    }
  } finally {
    if (changed) await refreshIndexedEntries()
  }
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
  if (isProjectInternalRelativePath(toRelativeProjectPath(draggedPath))
    || targetPath && isProjectInternalRelativePath(toRelativeProjectPath(targetPath))) return null
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
  if (isProjectInternalRelativePath(sourceRelativePath) || isProjectInternalRelativePath(targetRelativePath)) {
    throw new Error('Managed project entries cannot be moved')
  }
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
    projectFontFamilies: readonly(projectFontFamilies),
    projectFontCompositions: readonly(projectFontCompositions),
    projectFonts: readonly(projectFonts),
    fontRegistryError: readonly(fontRegistryError),
    fontRegistryReady: readonly(fontRegistryReady),
    projectFontLoadErrors: readonly(projectFontLoadErrors),
    projectIconSeries: readonly(projectIconSeries),
    iconRegistryError: readonly(iconRegistryError),
    iconRegistryReady: readonly(iconRegistryReady),
    projectIconCatalog: readonly(projectIconCatalog),
    renderEnvironment,
    projectIconLoadErrors: readonly(projectIconLoadErrors),
    projectDictionary: readonly(projectDictionary),
    projectResourceEnvironment,
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
    fileChangeRevision: readonly(fileChangeRevision),
    chooseProjectDirectory,
    ensureProjectManagementStructure,
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
    reloadProjectResourceEnvironment,
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
    resolveProjectInternalPath,
    readFile,
    isProjectAvailable,
    saveFile,
    createFolder,
    createFile,
    importProjectFontFiles,
    getProjectFontImportConflict,
    importProjectIconFile,
    getProjectIconImportConflict,
    installResourcePackageFile,
    uninstallResourcePackageFile,
    createEntryWithAvailableName,
    trashFile,
    trashUnusedProjectFontFiles,
    trashUnusedProjectIconFiles,
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
