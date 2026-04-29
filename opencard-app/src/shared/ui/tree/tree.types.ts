/**
 * 模块说明：
 * - 定义树组件通用协议 包括节点结构 动作载荷与上下文类型
 * 职责边界：
 * - 只维护类型契约 不包含运行时业务实现
 */
import type { ComputedRef, Ref } from 'vue'
import type { IconToken, IconTone } from '../icon/iconRegistry'

export type TreeIconTone = IconTone

export interface TreeItem {
  name: string
  key: string
  path?: string[]
  renamable?: boolean
  isExpandable?: boolean
  isExpanded?: boolean
  icon?: IconToken
  iconTone?: TreeIconTone
  iconColor?: string
  parent?: TreeItem | null
  children?: TreeItem[]
  metadata?: Record<string, unknown>
  actionKeys?: string[]
}

export type ActionCaller = 'tree' | 'node'

export interface ActionDefinition {
  key: string
  icon: IconToken
  title?: string
  children?: ActionDefinition[]
}

export interface NodeTreeActionCalledPayload {
  actionKey: string
  caller: ActionCaller
  node?: TreeItem
}

export interface NodeTreeTogglePayload {
  node: TreeItem
  expanded: boolean
}

export interface NodeTreeRenamePayload {
  node: TreeItem
  name: string
}

export type NodeTreeDropPosition = 'before' | 'inside' | 'after'

export type NodeTreeAllowedDropPositions = (target: TreeItem | null) => NodeTreeDropPosition[]

export interface NodeTreeCanDropPayload {
  dragged: TreeItem
  target: TreeItem | null
  position: NodeTreeDropPosition
}

export interface NodeTreeRepositioningPayload extends NodeTreeCanDropPayload {
  canDrop: boolean
}

export interface NodeTreeDropPayload extends NodeTreeCanDropPayload { }

export interface NodeTreeContext {
  selectedKeys: ComputedRef<string[]>
  selectedKeySet: ComputedRef<Set<string>>
  handleNodeClick: (key: string, node: TreeItem, modify: 'ctrl' | 'none') => void
  handleNodeDoubleClick: (node: TreeItem) => void
  handleNodeToggle: (node: TreeItem, expanded: boolean) => void
  callAction: (actionKey: string, caller: ActionCaller, node?: TreeItem) => void
  suppressClick: Ref<boolean>
  handleNodePointerDown: (node: TreeItem, event: MouseEvent) => void
  draggedNode: Ref<TreeItem | null>
  dropTargetNode: Ref<TreeItem | null>
  dropPosition: Ref<NodeTreeDropPosition | null>
  dropAllowed: Ref<boolean>
  actions: ComputedRef<Map<string, ActionDefinition>>
  renameEnabled: ComputedRef<boolean>
  renamingNodeKey: Ref<string | null>
  renameDraft: Ref<string>
  startNodeRename: (node: TreeItem) => void
  updateRenameDraft: (value: string) => void
  cancelNodeRename: () => void
  submitNodeRename: (node: TreeItem) => void
}
