/** Workspace entry lookup and key-only OcTree projection. */
import { computed, ref, watch, type Ref } from 'vue'
import type { OpenedEditorItem, EditorSession } from '../../workspace/store/editorSessionStore'
import { resolveEntryIcon, resolveFileType } from '../../workspace/model/fileTypes'
import type { OcTreeData, OcTreeItem, OcTreeRenameSelection } from '../../../shared/ui/tree/tree.types'
import type { IconToken } from '../../../shared/ui/icon/iconTokens'
import {
  resolveInstalledResourcePackageManifestPath,
} from '../../workspace/model/resourcePackage'
import type { RequiredPackage } from '../../workspace/model/projectPackageManifest'
import { PROJECT_FILE_TYPE_TITLE_KEYS } from '../../workspace/model/projectFileTitles'
import { notifyAppError } from '../../notifications/titlebarNotices'
import {
  PROJECT_DICTIONARY_FILE_NAME,
  PROJECT_FONT_DIRECTORY,
  PROJECT_FONT_REGISTRY_FILE_NAME,
  PROJECT_ICON_DIRECTORY,
  PROJECT_ICON_REGISTRY_FILE_NAME,
  PROJECT_INTERNAL_DIRECTORY_NAME,
  PROJECT_PROFILE_FILE_NAME,
  PROJECT_PACKAGE_DIRECTORY,
  PROJECT_PACKAGE_MANIFEST_FILE_NAME,
} from '../../workspace/model/projectStructure'

export const OPENED_EDITOR_CLOSE_ACTION_KEY = 'close-editor'
export const PROJECT_ENTRY_RENAME_ACTION_KEY = 'project-entry-rename'
export const PROJECT_ENTRY_REVEAL_ACTION_KEY = 'project-entry-reveal'
export const PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY = 'project-entry-copy-relative-path'
export const PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY = 'project-entry-copy-absolute-path'
const PROJECT_ENTRY_MORE_ACTION_PREFIX = 'project-entry-more:'
const PROJECT_ENTRY_DELETE_ACTION_PREFIX = 'project-entry-delete:'
const PROJECT_ENTRY_CONFIRM_DELETE_ACTION_PREFIX = 'project-entry-confirm-delete:'
const PROJECT_PACKAGE_DELETE_ACTION_PREFIX = 'project-package-delete:'
const PROJECT_PACKAGE_VERIFY_ACTION_PREFIX = 'project-package-verify:'
type ProjectManagementEntry = {
  path: string
  labelKey: string
  assetDirectory?: string
  packageDirectory?: boolean
}

const PROJECT_MANAGEMENT_ENTRIES: readonly ProjectManagementEntry[] = [
  { path: PROJECT_PROFILE_FILE_NAME, labelKey: 'fileTypes.opencardProjectProfile' },
  { path: PROJECT_DICTIONARY_FILE_NAME, labelKey: 'fileTypes.opencardDictionary' },
  { path: PROJECT_FONT_REGISTRY_FILE_NAME, labelKey: 'fileTypes.opencardFontRegistry', assetDirectory: PROJECT_FONT_DIRECTORY },
  { path: PROJECT_ICON_REGISTRY_FILE_NAME, labelKey: 'fileTypes.opencardIconRegistry', assetDirectory: PROJECT_ICON_DIRECTORY },
  {
    path: PROJECT_PACKAGE_MANIFEST_FILE_NAME,
    labelKey: 'fileTypes.opencardResourcePackage',
    assetDirectory: PROJECT_PACKAGE_DIRECTORY,
    packageDirectory: true,
  },
] as const

export function projectEntryMoreActionKey(entryKey: string): string {
  return `${PROJECT_ENTRY_MORE_ACTION_PREFIX}${entryKey}`
}

export function projectEntryDeleteActionKey(entryKey: string): string {
  return `${PROJECT_ENTRY_DELETE_ACTION_PREFIX}${entryKey}`
}

export function projectEntryConfirmDeleteActionKey(entryKey: string): string {
  return `${PROJECT_ENTRY_CONFIRM_DELETE_ACTION_PREFIX}${entryKey}`
}

export function isProjectEntryConfirmDeleteActionKey(actionKey: string): boolean {
  return actionKey.startsWith(PROJECT_ENTRY_CONFIRM_DELETE_ACTION_PREFIX)
}

export function projectPackageDeleteActionKey(packageKey: string): string {
  return `${PROJECT_PACKAGE_DELETE_ACTION_PREFIX}${packageKey}`
}
export function projectPackageVerifyActionKey(packageKey: string): string { return `${PROJECT_PACKAGE_VERIFY_ACTION_PREFIX}${packageKey}` }

type IndexedEntry = {
  name: string
  isDirectory?: boolean | null
}

type ProjectEntryView = {
  key: string
  relativePath: string
  label: string
  isDirectory: boolean
  isExpanded: boolean
  children: ProjectEntryView[]
}

type UseShellFileTreeOptions = {
  projectPath: Readonly<Ref<string>>
  indexedEntries: Readonly<Ref<readonly IndexedEntry[]>>
  packageManifests: Readonly<Ref<ReadonlyMap<string, RequiredPackage>>>
  openedEditorItems: Readonly<Ref<OpenedEditorItem[]>>
  activeSession: Readonly<Ref<EditorSession | null>>
  hideDotFiles?: Readonly<Ref<boolean>>
  isDirectoryExpanded: (path: string) => boolean
  activateSession: (sessionId: string) => void
  openPreviewFile: (path: string, options?: { title?: string }) => Promise<unknown>
  ensureProjectManagementStructure: () => Promise<void>
  translate: (key: string) => string
  registeredFontSources?: Readonly<Ref<readonly string[] | null>>
}

function normalizeShellPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function resolveFilenameRenameSelection(name: string): OcTreeRenameSelection {
  const extensionSeparator = name.lastIndexOf('.')
  const hasExtension = extensionSeparator > 0 && extensionSeparator < name.length - 1
  return { start: 0, end: hasExtension ? extensionSeparator : name.length }
}

function isDotPath(path: string): boolean {
  return path.split('/').some(part => part.startsWith('.') && part.length > 1)
}

export function useShellFileTree(options: UseShellFileTreeOptions) {
  const selectedProjectEntryKeys = ref<string[]>([])
  const selectedManagementKeys = ref<string[]>([])
  const openedEditorSelectedKeys = ref<string[]>([])
  const collapsedProjectManagementKeys = ref<ReadonlySet<string>>(new Set())
  const managedRegisteredFontSources = computed(() => new Set(
    (options.registeredFontSources?.value ?? []).map((source) => {
      const normalized = normalizeShellPath(source).replace(/^\/+/, '')
      return (normalized.startsWith(`${PROJECT_INTERNAL_DIRECTORY_NAME}/`)
        ? normalized
        : `${PROJECT_INTERNAL_DIRECTORY_NAME}/${normalized}`).toLocaleLowerCase()
    }),
  ))

  function setSelectedKeys(target: Ref<string[]>, nextKeys: string[]): void {
    if (target.value.length === nextKeys.length
      && target.value.every((key, index) => key === nextKeys[index])) return
    target.value = nextKeys
  }

  const projectProjection = computed(() => {
    const roots: ProjectEntryView[] = []
    const byRelativePath = new Map<string, ProjectEntryView>()
    const byKey = new Map<string, ProjectEntryView>()

    for (const file of options.indexedEntries.value) {
      const relativePath = normalizeShellPath(file.name)
      if ((options.hideDotFiles?.value ?? true) && isDotPath(relativePath)) continue
      const key = normalizeShellPath(`${options.projectPath.value}/${relativePath}`)
      const parts = relativePath.split('/')
      const isDirectory = Boolean(file.isDirectory)
      const entry: ProjectEntryView = {
        key,
        relativePath,
        label: parts[parts.length - 1] ?? relativePath,
        isDirectory,
        isExpanded: isDirectory && options.isDirectoryExpanded(key),
        children: [],
      }
      byRelativePath.set(relativePath, entry)
      byKey.set(key, entry)
    }

    for (const [relativePath, entry] of byRelativePath) {
      const separatorIndex = relativePath.lastIndexOf('/')
      if (separatorIndex < 0) roots.push(entry)
      else byRelativePath.get(relativePath.slice(0, separatorIndex))?.children.push(entry)
    }

    return { roots, byKey }
  })

  const projectTreeData = computed<OcTreeData>(() => {
    const items = new Map<string, OcTreeItem>()
    const children = new Map<string, readonly string[]>()

    for (const entry of projectProjection.value.byKey.values()) {
      const presentation = resolveEntryIcon(
        entry.key,
        entry.isDirectory,
        entry.isExpanded,
        options.projectPath.value,
        managedRegisteredFontSources.value,
      )
      items.set(entry.key, {
        label: entry.label,
        renameSelection: !entry.isDirectory
          ? resolveFilenameRenameSelection(entry.label)
          : undefined,
        icon: presentation.icon,
        iconTone: presentation.tone,
        renamable: true,
        draggable: true,
        actions: [projectEntryMoreActionKey(entry.key)],
        contextActions: [
          PROJECT_ENTRY_RENAME_ACTION_KEY,
          PROJECT_ENTRY_REVEAL_ACTION_KEY,
          PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY,
          PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY,
          { type: 'divider', key: 'project-entry-delete-divider' },
          projectEntryDeleteActionKey(entry.key),
        ],
      })
      if (entry.children.length > 0) {
        children.set(entry.key, entry.children.map((child) => child.key))
      }
    }

    return {
      rootKeys: projectProjection.value.roots.map((entry) => entry.key),
      items,
      children,
    }
  })

  const projectManagementProjection = computed(() => {
    const emptyTreeData: OcTreeData = { rootKeys: [], items: new Map(), children: new Map() }
    if (!options.projectPath.value) return {
      treeData: emptyTreeData,
      targetByNodeKey: new Map<string, string>(),
      nodeKeyByTargetPath: new Map<string, string>(),
      packageKeyByNodeKey: new Map<string, string>(),
    }
    const items = new Map<string, OcTreeItem>()
    const children = new Map<string, readonly string[]>()
    const targetByNodeKey = new Map<string, string>()
    const nodeKeyByTargetPath = new Map<string, string>()
    const packageKeyByNodeKey = new Map<string, string>()
    const rootKeys = PROJECT_MANAGEMENT_ENTRIES.map((entry) => {
      const key = normalizeShellPath(`${options.projectPath.value}/${entry.path}`)
      const presentation = entry.assetDirectory === PROJECT_PACKAGE_DIRECTORY
        ? { icon: 'file.package' as IconToken, tone: 'config' as const }
        : resolveEntryIcon(key, false, false, options.projectPath.value)
      items.set(key, {
        label: options.translate(entry.labelKey),
        tail: entry.path,
        icon: presentation.icon,
        iconTone: presentation.tone,
      })
      targetByNodeKey.set(key, key)
      nodeKeyByTargetPath.set(key, key)
      if (entry.packageDirectory && entry.assetDirectory === PROJECT_PACKAGE_DIRECTORY) {
        const directory = `${PROJECT_INTERNAL_DIRECTORY_NAME}/${entry.assetDirectory}`
        const packageNodeKeys = [...options.packageManifests.value.keys()].sort().map((packageKey) => {
          const nodeKey = normalizeShellPath(`${options.projectPath.value}/${directory}/${packageKey}`)
          const targetPath = resolveInstalledResourcePackageManifestPath(options.projectPath.value, packageKey)
          items.set(nodeKey, {
            label: packageKey,
            icon: 'file.package',
            iconTone: 'config',
            actions: [projectPackageVerifyActionKey(packageKey), projectPackageDeleteActionKey(packageKey)],
          })
          targetByNodeKey.set(nodeKey, targetPath)
          nodeKeyByTargetPath.set(targetPath, nodeKey)
          packageKeyByNodeKey.set(nodeKey, packageKey)
          return nodeKey
        })
        if (packageNodeKeys.length > 0) {
          children.set(key, packageNodeKeys)
        }
      }
      return key
    })
    return {
      treeData: { rootKeys, items, children },
      targetByNodeKey,
      nodeKeyByTargetPath,
      packageKeyByNodeKey,
    }
  })

  const projectManagementTreeData = computed<OcTreeData>(() => projectManagementProjection.value.treeData)

  const projectManagementExpandedKeys = computed(() => (
    [...projectManagementTreeData.value.children.keys()].filter(
      key => !collapsedProjectManagementKeys.value.has(key),
    )
  ))

  function setProjectManagementEntryExpanded(key: string, expanded: boolean): boolean {
    if ((projectManagementTreeData.value.children.get(key)?.length ?? 0) === 0) return false
    const nextCollapsedKeys = new Set(collapsedProjectManagementKeys.value)
    if (expanded) nextCollapsedKeys.delete(key)
    else nextCollapsedKeys.add(key)
    collapsedProjectManagementKeys.value = nextCollapsedKeys
    return true
  }

  const projectExpandedKeys = computed(() =>
    [...projectProjection.value.byKey.values()]
      .filter((entry) => entry.isExpanded && entry.children.length > 0)
      .map((entry) => entry.key),
  )

  const openedEditorTreeData = computed<OcTreeData>(() => ({
    rootKeys: options.openedEditorItems.value.map((item) => item.key),
    items: new Map(options.openedEditorItems.value.map((item) => [item.key, {
      label: item.label,
      icon: item.icon,
      iconTone: item.iconTone,
      actions: [OPENED_EDITOR_CLOSE_ACTION_KEY],
      contextActions: [OPENED_EDITOR_CLOSE_ACTION_KEY],
    }])),
    children: new Map(),
  }))

  function findProjectEntryByKey(key: string): ProjectEntryView | null {
    return projectProjection.value.byKey.get(normalizeShellPath(key)) ?? null
  }

  function findProjectPackageKeyByNodeKey(nodeKey: string): string | null {
    return projectManagementProjection.value.packageKeyByNodeKey.get(normalizeShellPath(nodeKey)) ?? null
  }

  function setProjectEntryExpanded(key: string, expanded: boolean): boolean {
    const entry = findProjectEntryByKey(key)
    if (!entry?.isDirectory || entry.children.length === 0) return false
    return options.isDirectoryExpanded(key) === expanded
  }

  async function handleProjectManagementSelect(nextSelectedKeys: string[]): Promise<void> {
    selectedManagementKeys.value = nextSelectedKeys
    const selectedKey = nextSelectedKeys[0]
    if (!selectedKey) return
    try {
      const isManagementRoot = projectManagementTreeData.value.rootKeys.includes(selectedKey)
      if (isManagementRoot) await options.ensureProjectManagementStructure()
      const targetPath = projectManagementProjection.value.targetByNodeKey.get(selectedKey)
      if (targetPath) await options.openPreviewFile(targetPath, { title: resolveManagedFileTitle(targetPath) })
    } catch (error) {
      notifyAppError('OC-E4001', { path: selectedKey, error })
    }
  }

  /** Managed project files open under the name they carry in the file tree instead of their JSON file name. */
  function resolveManagedFileTitle(targetPath: string): string | undefined {
    const titleKey = PROJECT_FILE_TYPE_TITLE_KEYS[resolveFileType(targetPath, options.projectPath.value).id]
    return titleKey ? options.translate(titleKey) : undefined
  }

  function syncSelectionFromActiveSession(session: EditorSession | null): void {
    if (!session) {
      setSelectedKeys(openedEditorSelectedKeys, [])
      setSelectedKeys(selectedProjectEntryKeys, [])
      setSelectedKeys(selectedManagementKeys, [])
      return
    }

    const opened = options.openedEditorItems.value.some((item) => item.key === session.id)
    setSelectedKeys(openedEditorSelectedKeys, opened ? [session.id] : [])

    if (session.resourceKind !== 'workspace' || !session.path) {
      setSelectedKeys(selectedProjectEntryKeys, [])
      setSelectedKeys(selectedManagementKeys, [])
      return
    }

    const normalizedSessionPath = normalizeShellPath(session.path)
    const entry = findProjectEntryByKey(normalizedSessionPath)
    const managedKey = projectManagementProjection.value.nodeKeyByTargetPath.get(normalizedSessionPath)
    setSelectedKeys(selectedProjectEntryKeys, entry ? [normalizedSessionPath] : [])
    setSelectedKeys(selectedManagementKeys, managedKey ? [managedKey] : [])
  }

  function handleOpenedEditorsSelect(nextSelectedKeys: string[]): void {
    openedEditorSelectedKeys.value = nextSelectedKeys
    const selectedSessionId = nextSelectedKeys[0]
    if (selectedSessionId) options.activateSession(selectedSessionId)
  }

  async function handleFileTreeSelect(nextSelectedKeys: string[]): Promise<void> {
    selectedProjectEntryKeys.value = nextSelectedKeys
    if (nextSelectedKeys.length !== 1) return
    const selectedEntry = findProjectEntryByKey(nextSelectedKeys[0])
    if (!selectedEntry || selectedEntry.isDirectory) return
    try {
      await options.openPreviewFile(selectedEntry.key)
    } catch (error) {
      notifyAppError('OC-E4001', { path: selectedEntry.key, error })
    }
  }

  watch(
    [() => {
      const session = options.activeSession.value
      return session ? `${session.id}\0${session.resourceKind}\0${session.path ?? ''}` : ''
    }, () => projectProjection.value.byKey, () => projectManagementProjection.value.nodeKeyByTargetPath],
    () => syncSelectionFromActiveSession(options.activeSession.value),
    { immediate: true },
  )

  return {
    projectTreeData,
    projectManagementTreeData,
    projectManagementExpandedKeys,
    projectExpandedKeys,
    openedEditorTreeData,
    selectedProjectEntryKeys,
    selectedManagementKeys,
    openedEditorSelectedKeys,
    handleOpenedEditorsSelect,
    handleFileTreeSelect,
    handleProjectManagementSelect,
    findProjectEntryByKey,
    findProjectPackageKeyByNodeKey,
    setProjectManagementEntryExpanded,
    setProjectEntryExpanded,
  }
}
