/** Workspace entry lookup and key-only OcTree projection. */
import { computed, ref, watch, type Ref } from 'vue'
import type { OpenedEditorItem, EditorSession } from '../../workspace/store/editorSessionStore'
import { resolveEntryIcon } from '../../workspace/model/fileTypes'
import type { OcTreeData, OcTreeItem, OcTreeRenameSelection } from '../../../shared/ui/tree/tree.types'
import { reportAppError } from '../../logging/appErrorCatalog'
import {
  PROJECT_CUSTOM_BLOCK_DIRECTORY,
  PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME,
  PROJECT_DICTIONARY_FILE_NAME,
  PROJECT_FONT_DIRECTORY,
  PROJECT_FONT_REGISTRY_FILE_NAME,
  PROJECT_ICON_DIRECTORY,
  PROJECT_ICON_REGISTRY_FILE_NAME,
  PROJECT_INTERNAL_DIRECTORY_NAME,
  PROJECT_PROFILE_FILE_NAME,
} from '../../workspace/model/projectStructure'

export const OPENED_EDITOR_CLOSE_ACTION_KEY = 'close-editor'
export const PROJECT_ENTRY_RENAME_ACTION_KEY = 'project-entry-rename'
export const PROJECT_ENTRY_REVEAL_ACTION_KEY = 'project-entry-reveal'
export const PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY = 'project-entry-copy-relative-path'
export const PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY = 'project-entry-copy-absolute-path'
export const PROJECT_UNUSED_FONT_REMOVE_ACTION_KEY = 'project-unused-font-remove'
export const PROJECT_UNUSED_FONTS_CLEAN_ACTION_KEY = 'project-unused-fonts-clean'
export const PROJECT_UNUSED_ICON_REMOVE_ACTION_KEY = 'project-unused-icon-remove'
export const PROJECT_UNUSED_ICONS_CLEAN_ACTION_KEY = 'project-unused-icons-clean'
const PROJECT_ENTRY_MORE_ACTION_PREFIX = 'project-entry-more:'
const PROJECT_ENTRY_DELETE_ACTION_PREFIX = 'project-entry-delete:'
const PROJECT_ENTRY_CONFIRM_DELETE_ACTION_PREFIX = 'project-entry-confirm-delete:'
type ProjectManagementEntry = {
  path: string
  labelKey: string
  assetDirectory?: string
}

const PROJECT_MANAGEMENT_ENTRIES: readonly ProjectManagementEntry[] = [
  { path: PROJECT_PROFILE_FILE_NAME, labelKey: 'fileTypes.opencardProjectProfile' },
  { path: PROJECT_DICTIONARY_FILE_NAME, labelKey: 'fileTypes.opencardDictionary' },
  { path: PROJECT_FONT_REGISTRY_FILE_NAME, labelKey: 'fileTypes.opencardFontRegistry', assetDirectory: PROJECT_FONT_DIRECTORY },
  { path: PROJECT_ICON_REGISTRY_FILE_NAME, labelKey: 'fileTypes.opencardIconRegistry', assetDirectory: PROJECT_ICON_DIRECTORY },
  { path: PROJECT_CUSTOM_BLOCK_REGISTRY_FILE_NAME, labelKey: 'fileTypes.opencardCustomBlockRegistry', assetDirectory: PROJECT_CUSTOM_BLOCK_DIRECTORY },
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
  openedEditorItems: Readonly<Ref<OpenedEditorItem[]>>
  activeSession: Readonly<Ref<EditorSession | null>>
  hideDotFiles?: Readonly<Ref<boolean>>
  isDirectoryExpanded: (path: string) => boolean
  activateSession: (sessionId: string) => void
  openPreviewFile: (path: string) => Promise<unknown>
  ensureProjectManagementStructure: () => Promise<void>
  translate: (key: string) => string
  registeredFontSources?: Readonly<Ref<readonly string[] | null>>
  registeredIconSources?: Readonly<Ref<readonly string[] | null>>
}

function normalizeShellPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

function managedSourceIdentities(sources: ReadonlySet<string>): Set<string> {
  return new Set([...sources].map((source) => {
    const normalized = normalizeShellPath(source).replace(/^\/+/, '')
    return (normalized.startsWith(`${PROJECT_INTERNAL_DIRECTORY_NAME}/`)
      ? normalized
      : `${PROJECT_INTERNAL_DIRECTORY_NAME}/${normalized}`).toLocaleLowerCase()
  }))
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
  const selectedFileKeys = ref<string[]>([])
  const openedEditorSelectedKeys = ref<string[]>([])
  const collapsedProjectManagementKeys = ref<ReadonlySet<string>>(new Set())
  const registeredFontSources = computed(() => new Set(options.registeredFontSources?.value ?? []))
  const registeredIconSources = computed(() => new Set(options.registeredIconSources?.value ?? []))
  const managedRegisteredFontSources = computed(() => managedSourceIdentities(registeredFontSources.value))
  const managedRegisteredIconSources = computed(() => managedSourceIdentities(registeredIconSources.value))

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
        registeredFontSources.value,
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
          projectEntryDeleteActionKey(entry.key),
          PROJECT_ENTRY_REVEAL_ACTION_KEY,
          PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY,
          PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY,
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

  const projectManagementTreeData = computed<OcTreeData>(() => {
    if (!options.projectPath.value) return { rootKeys: [], items: new Map(), children: new Map() }
    const items = new Map<string, OcTreeItem>()
    const children = new Map<string, readonly string[]>()
    const rootKeys = PROJECT_MANAGEMENT_ENTRIES.map((entry) => {
      const key = normalizeShellPath(`${options.projectPath.value}/${entry.path}`)
      const presentation = resolveEntryIcon(key, false, false, options.projectPath.value)
      items.set(key, {
        label: options.translate(entry.labelKey),
        icon: presentation.icon,
        iconTone: presentation.tone,
      })
      if (entry.assetDirectory) {
        const directory = `${PROJECT_INTERNAL_DIRECTORY_NAME}/${entry.assetDirectory}`
        const isFontRegistry = entry.path === PROJECT_FONT_REGISTRY_FILE_NAME
        const isIconRegistry = entry.path === PROJECT_ICON_REGISTRY_FILE_NAME
        const canResolveFontUsage = options.registeredFontSources?.value !== null
        const canResolveIconUsage = options.registeredIconSources?.value !== null
        let unusedAssetCount = 0
        const childKeys = options.indexedEntries.value.flatMap((indexedEntry) => {
          const relativePath = normalizeShellPath(indexedEntry.name)
          if (indexedEntry.isDirectory || !relativePath.startsWith(`${directory}/`)) return []
          const filename = relativePath.slice(directory.length + 1)
          if (!filename || filename.includes('/')) return []
          const childKey = normalizeShellPath(`${options.projectPath.value}/${relativePath}`)
          const childPresentation = resolveEntryIcon(
            childKey,
            false,
            false,
            options.projectPath.value,
            managedRegisteredFontSources.value,
            managedRegisteredIconSources.value,
          )
          const isUnusedFont = isFontRegistry
            && canResolveFontUsage
            && childPresentation.icon === 'file.font'
            && !managedRegisteredFontSources.value.has(relativePath.toLocaleLowerCase())
          const isUnusedIcon = isIconRegistry
            && canResolveIconUsage
            && childPresentation.icon === 'file.image'
            && !managedRegisteredIconSources.value.has(relativePath.toLocaleLowerCase())
          const removeActionKey = isUnusedFont
            ? PROJECT_UNUSED_FONT_REMOVE_ACTION_KEY
            : isUnusedIcon ? PROJECT_UNUSED_ICON_REMOVE_ACTION_KEY : null
          if (removeActionKey) unusedAssetCount += 1
          items.set(childKey, {
            label: filename,
            icon: childPresentation.icon,
            iconTone: childPresentation.tone,
            ...(removeActionKey ? {
              actions: [removeActionKey],
              contextActions: [removeActionKey],
            } : {}),
          })
          return [childKey]
        })
        if (childKeys.length > 0) children.set(key, childKeys)
        if (unusedAssetCount > 0) {
          const cleanActionKey = isFontRegistry
            ? PROJECT_UNUSED_FONTS_CLEAN_ACTION_KEY
            : PROJECT_UNUSED_ICONS_CLEAN_ACTION_KEY
          items.set(key, {
            ...items.get(key)!,
            actions: [cleanActionKey],
            contextActions: [cleanActionKey],
          })
        }
      }
      return key
    })
    return { rootKeys, items, children }
  })

  const projectManagementExpandedKeys = computed(() => (
    projectManagementTreeData.value.rootKeys.filter(
      key => (projectManagementTreeData.value.children.get(key)?.length ?? 0) > 0
        && !collapsedProjectManagementKeys.value.has(key),
    )
  ))

  const unusedProjectFontFileKeys = computed(() => [...projectManagementTreeData.value.items]
    .filter(([, item]) => item.actions?.includes(PROJECT_UNUSED_FONT_REMOVE_ACTION_KEY))
    .map(([key]) => key))
  const unusedProjectIconFileKeys = computed(() => [...projectManagementTreeData.value.items]
    .filter(([, item]) => item.actions?.includes(PROJECT_UNUSED_ICON_REMOVE_ACTION_KEY))
    .map(([key]) => key))

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

  function setProjectEntryExpanded(key: string, expanded: boolean): boolean {
    const entry = findProjectEntryByKey(key)
    if (!entry?.isDirectory || entry.children.length === 0) return false
    return options.isDirectoryExpanded(key) === expanded
  }

  async function handleProjectManagementSelect(nextSelectedKeys: string[]): Promise<void> {
    selectedFileKeys.value = nextSelectedKeys
    const selectedKey = nextSelectedKeys[0]
    if (!selectedKey) return
    try {
      if (projectManagementTreeData.value.rootKeys.includes(selectedKey)) {
        await options.ensureProjectManagementStructure()
      }
      await options.openPreviewFile(selectedKey)
    } catch (error) {
      reportAppError('OC-E4001', { path: selectedKey, error })
    }
  }

  function syncSelectionFromActiveSession(session: EditorSession | null): void {
    if (!session) {
      setSelectedKeys(openedEditorSelectedKeys, [])
      setSelectedKeys(selectedFileKeys, [])
      return
    }

    const opened = options.openedEditorItems.value.some((item) => item.key === session.id)
    setSelectedKeys(openedEditorSelectedKeys, opened ? [session.id] : [])

    if (session.resourceKind !== 'workspace' || !session.path) {
      setSelectedKeys(selectedFileKeys, [])
      return
    }

    const entry = findProjectEntryByKey(session.path)
    const managed = projectManagementTreeData.value.items.has(session.path)
    setSelectedKeys(selectedFileKeys, entry || managed ? [session.path] : [])
  }

  function handleOpenedEditorsSelect(nextSelectedKeys: string[]): void {
    openedEditorSelectedKeys.value = nextSelectedKeys
    const selectedSessionId = nextSelectedKeys[0]
    if (selectedSessionId) options.activateSession(selectedSessionId)
  }

  async function handleFileTreeSelect(nextSelectedKeys: string[]): Promise<void> {
    selectedFileKeys.value = nextSelectedKeys
    if (nextSelectedKeys.length !== 1) return
    const selectedEntry = findProjectEntryByKey(nextSelectedKeys[0])
    if (!selectedEntry || selectedEntry.isDirectory) return
    try {
      await options.openPreviewFile(selectedEntry.key)
    } catch (error) {
      reportAppError('OC-E4001', { path: selectedEntry.key, error })
    }
  }

  watch(
    () => {
      const session = options.activeSession.value
      return session ? `${session.id}\0${session.resourceKind}\0${session.path ?? ''}` : ''
    },
    () => syncSelectionFromActiveSession(options.activeSession.value),
    { immediate: true },
  )

  return {
    projectTreeData,
    projectManagementTreeData,
    projectManagementExpandedKeys,
    unusedProjectFontFileKeys,
    unusedProjectIconFileKeys,
    projectExpandedKeys,
    openedEditorTreeData,
    selectedFileKeys,
    openedEditorSelectedKeys,
    handleOpenedEditorsSelect,
    handleFileTreeSelect,
    handleProjectManagementSelect,
    findProjectEntryByKey,
    setProjectManagementEntryExpanded,
    setProjectEntryExpanded,
  }
}
