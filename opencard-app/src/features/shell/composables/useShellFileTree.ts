/** Workspace entry lookup and key-only OcTree projection. */
import { computed, ref, watch, type Ref } from 'vue'
import type { OpenedEditorItem, EditorSession } from '../../workspace/store/editorSessionStore'
import { resolveEntryIcon } from '../../workspace/model/fileTypes'
import type { OcTreeData, OcTreeItem } from '../../../shared/ui/tree/tree.types'

export const OPENED_EDITOR_CLOSE_ACTION_KEY = 'close-editor'

type IndexedEntry = {
  name: string
  isDirectory?: boolean | null
}

type ProjectEntryView = {
  key: string
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
  isDirectoryExpanded: (path: string) => boolean
  activateSession: (sessionId: string) => void
  openPreviewFile: (path: string) => Promise<unknown>
}

function normalizeShellPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function useShellFileTree(options: UseShellFileTreeOptions) {
  const selectedFileKeys = ref<string[]>([])
  const openedEditorSelectedKeys = ref<string[]>([])

  const projectProjection = computed(() => {
    const roots: ProjectEntryView[] = []
    const byRelativePath = new Map<string, ProjectEntryView>()
    const byKey = new Map<string, ProjectEntryView>()

    for (const file of options.indexedEntries.value) {
      const relativePath = normalizeShellPath(file.name)
      const key = normalizeShellPath(`${options.projectPath.value}/${relativePath}`)
      const parts = relativePath.split('/')
      const isDirectory = Boolean(file.isDirectory)
      const entry: ProjectEntryView = {
        key,
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
      const presentation = resolveEntryIcon(entry.key, entry.isDirectory, entry.isExpanded)
      items.set(entry.key, {
        label: entry.label,
        icon: presentation.icon,
        iconTone: presentation.tone,
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
    }])),
    children: new Map(),
  }))

  function findProjectEntryByKey(key: string): ProjectEntryView | null {
    return projectProjection.value.byKey.get(normalizeShellPath(key)) ?? null
  }

  function syncSelectionFromActiveSession(session: EditorSession | null): void {
    if (!session) {
      openedEditorSelectedKeys.value = []
      selectedFileKeys.value = []
      return
    }

    const opened = options.openedEditorItems.value.some((item) => item.key === session.id)
    openedEditorSelectedKeys.value = opened ? [session.id] : []

    if (session.resourceKind !== 'workspace' || !session.path) {
      selectedFileKeys.value = []
      return
    }

    const entry = findProjectEntryByKey(session.path)
    selectedFileKeys.value = entry ? [entry.key] : []
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
      console.error('预览打开文件失败:', error)
    }
  }

  watch(
    () => options.activeSession.value,
    (session) => syncSelectionFromActiveSession(session),
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
