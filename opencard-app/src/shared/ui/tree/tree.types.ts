/**
 * 模块说明：
 * - 定义树组件通用协议 包括节点结构 动作载荷与上下文类型
 * 职责边界：
 * - 只维护类型契约 不包含运行时业务实现
 */
import type { ComputedRef, Ref } from 'vue'
import type { IconTone } from '../icon/iconRegistry'

export type TreeIconTone = IconTone

export interface ITreeNode {
  name: string
  key: string
  path?: string[]
  renamable?: boolean
  isExpandable?: boolean
  isExpanded?: boolean
  icon?: string
  iconTone?: TreeIconTone
  iconColor?: string
  parent?: ITreeNode | null
  children?: ITreeNode[]
  metadata?: Record<string, unknown>
  actionKeys?: string[]
}

export type ActionCaller = 'tree' | 'node'

export interface ActionDefinition {
  key: string
  icon: string
  title?: string
  children?: ActionDefinition[]
}

export interface NodeTreeActionCalledPayload {
  actionKey: string
  caller: ActionCaller
  node?: ITreeNode
}

export interface NodeTreeTogglePayload {
  node: ITreeNode
  expanded: boolean
}

export interface NodeTreeRenamePayload {
  node: ITreeNode
  name: string
}

export type NodeTreeDropPosition = 'before' | 'inside' | 'after'

export type NodeTreeAllowedDropPositions = (target: ITreeNode | null) => NodeTreeDropPosition[]

export interface NodeTreeCanDropPayload {
  dragged: ITreeNode
  target: ITreeNode | null
  position: NodeTreeDropPosition
}

export interface NodeTreeRepositioningPayload extends NodeTreeCanDropPayload {
  canDrop: boolean
}

export interface NodeTreeDropPayload extends NodeTreeCanDropPayload {}

export interface NodeTreeContext {
  selectedKeys: ComputedRef<string[]>
  selectedKeySet: ComputedRef<Set<string>>
  handleNodeClick: (key: string, node: ITreeNode, modify: 'ctrl' | 'none') => void
  handleNodeDoubleClick: (node: ITreeNode) => void
  handleNodeToggle: (node: ITreeNode, expanded: boolean) => void
  callAction: (actionKey: string, caller: ActionCaller, node?: ITreeNode) => void
  suppressClick: Ref<boolean>
  handleNodePointerDown: (node: ITreeNode, event: MouseEvent) => void
  draggedNode: Ref<ITreeNode | null>
  dropTargetNode: Ref<ITreeNode | null>
  dropPosition: Ref<NodeTreeDropPosition | null>
  dropAllowed: Ref<boolean>
  actions: ComputedRef<Map<string, ActionDefinition>>
  renameEnabled: ComputedRef<boolean>
  renamingNodeKey: Ref<string | null>
  renameDraft: Ref<string>
  startNodeRename: (node: ITreeNode) => void
  updateRenameDraft: (value: string) => void
  cancelNodeRename: () => void
  submitNodeRename: (node: ITreeNode) => void
}
