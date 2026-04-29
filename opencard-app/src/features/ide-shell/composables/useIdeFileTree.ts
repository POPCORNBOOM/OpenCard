/**
 * 模块说明：
 * - 管理 IDE 文件树投影与项目树 已打开树选中同步
 * 职责边界：
 * - 只处理视图投影与交互编排 不处理底层文件规则
 */
import { computed, ref, watch, type Ref } from 'vue'
import { resolveEntryIcon } from '../../workspace/model/fileTypes'
import type { TreeItem } from '../../../shared/ui/tree/tree.types'
import type { EditorSession } from '../../workspace/store/editorSessionStore'

type IndexedEntry = {
  name: string
  isDirectory?: boolean | null
}

type UseIdeFileTreeOptions = {
  projectPath: Readonly<Ref<string>>
  indexedEntries: Readonly<Ref<readonly IndexedEntry[]>>
  openedFileNodes: Readonly<Ref<TreeItem[]>>
  activeSession: Readonly<Ref<EditorSession | null>>
  isDirectoryExpanded: (path: string) => boolean
  activateSession: (sessionId: string) => void
  openPreviewFile: (path: string) => Promise<unknown>
}

function normalizeIdePath(path: string) {
  return path.replace(/\\/g, '/').replace(/\/+$/, '')
}

export function useIdeFileTree(options: UseIdeFileTreeOptions) {
  const selectedFileKeys = ref<string[]>([])
  const openedEditorSelectedKeys = ref<string[]>([])

  const fileTree = computed<TreeItem[]>(() => {
    if (!options.indexedEntries.value.length) {
      return []
    }

    const root: TreeItem[] = []
    const map = new Map<string, TreeItem>()

    options.indexedEntries.value.forEach((file) => {
      const relativePath = file.name
      const fullPath = normalizeIdePath(`${options.projectPath.value}/${relativePath}`)
      const parts = relativePath.split(/[/\\]/)
      const displayName = parts[parts.length - 1]

      const isDirectory = Boolean(file.isDirectory)
      const entryIcon = resolveEntryIcon(
        relativePath,
        isDirectory,
        isDirectory ? options.isDirectoryExpanded(fullPath) : false,
      )

      const node: TreeItem = {
        name: displayName,
        key: fullPath,
        isExpandable: isDirectory,
        isExpanded: isDirectory ? options.isDirectoryExpanded(fullPath) : false,
        icon: entryIcon.icon,
        iconTone: entryIcon.tone,
        children: isDirectory ? [] : undefined,
        metadata: {
          relativePath,
          isDirectory,
        },
      }

      map.set(relativePath, node)
    })

    options.indexedEntries.value.forEach((file) => {
      const relativePath = file.name
      const node = map.get(relativePath)
      if (!node) {
        return
      }

      const parts = relativePath.split(/[/\\]/)
      if (parts.length === 1) {
        root.push(node)
      } else {
        const parentRelativePath = parts.slice(0, -1).join('/')
        const parent = map.get(parentRelativePath)
        if (parent?.children) {
          parent.children.push(node)
        }
      }
    })

    return root
  })

  function findTreeNodeByKey(nodes: TreeItem[], key: string): TreeItem | null {
    for (const node of nodes) {
      if (normalizeIdePath(node.key) === normalizeIdePath(key)) {
        return node
      }

      const childNode = findTreeNodeByKey(node.children ?? [], key)
      if (childNode) {
        return childNode
      }
    }

    return null
  }

  function syncSelectionFromActiveSession(session: EditorSession | null) {
    if (!session) {
      openedEditorSelectedKeys.value = []
      selectedFileKeys.value = []
      return
    }

    const openedEditorNode = options.openedFileNodes.value.find((node) => node.key === session.id)
    openedEditorSelectedKeys.value = openedEditorNode ? [openedEditorNode.key] : []

    if (session.resourceKind !== 'workspace' || !session.path) {
      selectedFileKeys.value = []
      return
    }

    const normalizedPath = normalizeIdePath(session.path)
    const projectTreeNode = findTreeNodeByKey(fileTree.value, normalizedPath)
    selectedFileKeys.value = projectTreeNode ? [projectTreeNode.key] : []
  }

  function handleOpenedEditorsSelect(nextSelectedKeys: string[]) {
    openedEditorSelectedKeys.value = nextSelectedKeys
    const selectedSessionId = nextSelectedKeys[0]
    if (selectedSessionId) {
      options.activateSession(selectedSessionId)
    }
  }

  async function handleFileTreeSelect(nextSelectedKeys: string[]) {
    selectedFileKeys.value = nextSelectedKeys
    if (nextSelectedKeys.length !== 1) {
      return
    }

    const selectedNode = findTreeNodeByKey(fileTree.value, nextSelectedKeys[0])
    if (!selectedNode || selectedNode.metadata?.isDirectory) {
      return
    }

    try {
      await options.openPreviewFile(selectedNode.key)
    } catch (error) {
      console.error('预览打开文件失败:', error)
    }
  }

  watch(
    () => options.activeSession.value,
    (session) => {
      syncSelectionFromActiveSession(session)
    },
    { immediate: true },
  )

  return {
    fileTree,
    selectedFileKeys,
    openedEditorSelectedKeys,
    handleOpenedEditorsSelect,
    handleFileTreeSelect,
    findTreeNodeByKey,
  }
}
