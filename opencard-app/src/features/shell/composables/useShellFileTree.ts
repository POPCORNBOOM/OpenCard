/** Workspace entry lookup and key-only OcTree projection. */
import { computed, ref, watch, type Ref } from 'vue'
import type { OpenedEditorItem, EditorSession } from '../../workspace/store/editorSessionStore'
import { resolveEntryIcon, resolveProjectTreeFilePresentation } from '../../workspace/model/fileTypes'
import type { OcTreeData, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import { reportAppError } from '../../logging/appErrorCatalog'

export const OPENED_EDITOR_CLOSE_ACTION_KEY = 'close-editor'
export const PROJECT_ENTRY_RENAME_ACTION_KEY = 'project-entry-rename'
export const PROJECT_ENTRY_REVEAL_ACTION_KEY = 'project-entry-reveal'
export const PROJECT_ENTRY_COPY_RELATIVE_PATH_ACTION_KEY = 'project-entry-copy-relative-path'
export const PROJECT_ENTRY_COPY_ABSOLUTE_PATH_ACTION_KEY = 'project-entry-copy-absolute-path'
const PROJECT_ENTRY_MORE_ACTION_PREFIX = 'project-entry-more:'
const PROJECT_ENTRY_DELETE_ACTION_PREFIX = 'project-entry-delete:'
const PROJECT_ENTRY_CONFIRM_DELETE_ACTION_PREFIX = 'project-entry-confirm-delete:'

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
  tail?: string
  isDirectory: boolean
  isExpanded: boolean
  rootPriority: number | null
  children: ProjectEntryView[]
}

type UseShellFileTreeOptions = {
  projectPath: Readonly<Ref<string>>
  indexedEntries: Readonly<Ref<readonly IndexedEntry[]>>
  openedEditorItems: Readonly<Ref<OpenedEditorItem[]>>
  activeSession: Readonly<Ref<EditorSession | null>>
  isDirectoryExpanded: (path: string) => boolean
  activateSession: (sessionId: string) => void
  openPreviewFile: (path: string) => Promise<unknown>
  translate: (key: string) => string
  registeredFontSources?: Readonly<Ref<readonly string[]>>
}

function normalizeShellPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function useShellFileTree(options: UseShellFileTreeOptions) {
  const selectedFileKeys = ref<string[]>([])
  const openedEditorSelectedKeys = ref<string[]>([])
  const registeredFontSources = computed(() => new Set(options.registeredFontSources?.value ?? []))

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
      const key = normalizeShellPath(`${options.projectPath.value}/${relativePath}`)
      const parts = relativePath.split('/')
      const isDirectory = Boolean(file.isDirectory)
      const rootPresentation = !isDirectory && parts.length === 1
        ? resolveProjectTreeFilePresentation(key, options.projectPath.value)
        : null
      const entry: ProjectEntryView = {
        key,
        relativePath,
        label: parts[parts.length - 1] ?? relativePath,
        tail: rootPresentation ? options.translate(rootPresentation.annotationKey) : undefined,
        isDirectory,
        isExpanded: isDirectory && options.isDirectoryExpanded(key),
        rootPriority: rootPresentation?.priority ?? null,
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

    roots.sort((left, right) => (
      (left.rootPriority ?? Number.MAX_SAFE_INTEGER)
      - (right.rootPriority ?? Number.MAX_SAFE_INTEGER)
    ))

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
        tail: entry.tail,
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

  const projectExpandedKeys = computed(() =>
    [...projectProjection.value.byKey.values()]
      .filter((entry) => entry.isDirectory && entry.isExpanded)
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
    setSelectedKeys(selectedFileKeys, entry ? [entry.key] : [])
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
    projectExpandedKeys,
    openedEditorTreeData,
    selectedFileKeys,
    openedEditorSelectedKeys,
    handleOpenedEditorsSelect,
    handleFileTreeSelect,
    findProjectEntryByKey,
  }
}
