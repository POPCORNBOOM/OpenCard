<!--
  使用说明：
  - 作为通用树容器使用，输入 `nodes`、`selectedKeys`、`expanded`、`actions/actionKeys` 等。
  - 选择态请使用 `:selected-keys` + `@update:selected-keys`，不要传节点对象 Map。
  - 根展开可用 `v-model:expanded` 受控，也可不传由组件内部维护。

  职责边界：
  - 负责树交互协议与状态机（选择、根展开、重命名交互、拖拽重排交互）。
  - 只上抛用户意图事件，不落业务规则与持久化逻辑。

  主要输出事件：
  - `update:selectedKeys`、`update:expanded`
  - `action-called`、`node-toggle`、`node-rename`、`node-drop`
-->
<template>
  <div
    ref="treeRootElement"
    class="node-tree"
    :class="{
      'drag-over-root': draggedNode && !dropTargetNode && dropPosition,
      'drop-invalid': draggedNode && !dropTargetNode && dropPosition && !dropAllowed,
      dragging: draggedNode,
    }"
  >
    <div class="root-content" @click="handleClick">
      <i class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
      <span class="root-title">{{ props.title }}</span>
      <div v-if="treeActions.length" class="root-actions">
        <TreeActionButton
          v-for="action in treeActions"
          :key="action.key"
          :action="action"
          caller="tree"
          @trigger="handleActionTrigger"
        />
      </div>
    </div>

    <div v-if="isExpanded" class="tree-children">
      <TreeNode v-for="node in nodes" :key="node.key" :node="node" :level="1" />
    </div>
  </div>
</template>

<script setup lang="ts">
// Vue 基础能力与依赖组件。
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, provide, ref, watch, type ComputedRef, type Ref } from 'vue'
import TreeActionButton from './TreeActionButton.vue'
import TreeNode, { type ITreeNode } from './TreeNode.vue'

// Action 调用来源。
export type ActionCaller = 'tree' | 'node'

// 操作按钮定义。
export interface ActionDefinition {
  key: string
  icon: string
  title?: string
  children?: ActionDefinition[]
}

// 业务层收到的 action 事件载荷。
export interface NodeTreeActionCalledPayload {
  actionKey: string
  caller: ActionCaller
  node?: ITreeNode
}

// 节点展开事件载荷。
export interface NodeTreeTogglePayload {
  node: ITreeNode
  expanded: boolean
}

// 节点重命名事件载荷。
export interface NodeTreeRenamePayload {
  node: ITreeNode
  name: string
}

// 拖拽落点协议。
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

// 注入给 TreeNode 的交互上下文。
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

// 组件输入协议。
interface Props {
  nodes: ITreeNode[]
  multiSelect?: boolean
  selectedKeys?: string[]
  title?: string
  expanded?: boolean
  actions?: Map<string, ActionDefinition>
  actionKeys?: string[]
  canDrop?: (payload: NodeTreeCanDropPayload) => boolean
  allowedDropPositions?: NodeTreeAllowedDropPositions
}

// Props 默认值。
const props = withDefaults(defineProps<Props>(), {
  multiSelect: true,
  selectedKeys: () => [],
  actions: () => new Map<string, ActionDefinition>(),
  actionKeys: () => [],
  canDrop: undefined,
  allowedDropPositions: undefined,
})

// 对外事件协议。
const emit = defineEmits<{
  'update:selectedKeys': [value: string[]]
  'update:expanded': [value: boolean]
  'node-dblclick': [node: ITreeNode]
  'node-toggle': [payload: NodeTreeTogglePayload]
  'node-rename': [payload: NodeTreeRenamePayload]
  'action-called': [payload: NodeTreeActionCalledPayload]
  'drag-start': [node: ITreeNode]
  'drag-end': [node: ITreeNode]
  'repositioning': [payload: NodeTreeRepositioningPayload]
  'node-drop': [payload: NodeTreeDropPayload]
}>()

// 根展开状态（支持受控/非受控）。
const treeExpanded = ref(props.expanded ?? false)
const isRootExpandedControlled = computed(() => props.expanded !== undefined)
const isExpanded = computed(() => treeExpanded.value)
const treeRootElement = ref<HTMLDivElement | null>(null)

// 拖拽过程状态。
const pendingDrag = ref<{ node: ITreeNode; startX: number; startY: number } | null>(null)
const draggedNode = ref<ITreeNode | null>(null)
const dropTargetNode = ref<ITreeNode | null>(null)
const dropPosition = ref<NodeTreeDropPosition | null>(null)
const dropAllowed = ref(false)
const suppressClick = ref(false)

// 重命名交互状态。
const renamingNodeKey = ref<string | null>(null)
const renameDraft = ref('')
const instance = getCurrentInstance()
const vnodeProps = (instance?.vnode.props ?? {}) as Record<string, unknown>
const renameEnabled = computed(() => Boolean(vnodeProps.onNodeRename || vnodeProps.onNodeRenameOnce))

// 外部受控展开变更同步。
watch(
  () => props.expanded,
  (nextExpanded) => {
    if (nextExpanded === undefined) {
      return
    }

    treeExpanded.value = nextExpanded
  },
)

// 选择态与动作列表派生。
const selectedKeys = computed(() => props.selectedKeys)
const selectedKeySet = computed(() => new Set(selectedKeys.value))

const treeActions = computed(() => {
  return props.actionKeys
    .map((key) => props.actions.get(key))
    .filter((action): action is ActionDefinition => action !== undefined)
})

// 当前树的 key->node 映射，供高频交互查询。
const nodeMap = computed(() => {
  const map = new Map<string, ITreeNode>()
  const visit = (nodes: ITreeNode[]) => {
    for (const node of nodes) {
      map.set(node.key, node)
      if (node.children && node.children.length > 0) {
        visit(node.children)
      }
    }
  }

  visit(props.nodes)
  return map
})

// 重命名节点失去单选时自动取消。
watch(
  selectedKeys,
  (nextSelectedKeys) => {
    if (!renamingNodeKey.value) {
      return
    }

    if (nextSelectedKeys.length !== 1 || !nextSelectedKeys.includes(renamingNodeKey.value)) {
      cancelNodeRename()
    }
  },
)

// 节点双击上抛。
function handleNodeDoubleClick(node: ITreeNode) {
  emit('node-dblclick', node)
}

// 选择逻辑（单选/多选切换）。
function handleNodeClick(key: string, _node: ITreeNode, modify: 'ctrl' | 'none') {
  if (renamingNodeKey.value && renamingNodeKey.value !== key) {
    cancelNodeRename()
  }

  if (!props.multiSelect || modify === 'none') {
    emit('update:selectedKeys', [key])
    return
  }

  const nextSelectedKeys = [...new Set(selectedKeys.value)]
  const existingIndex = nextSelectedKeys.indexOf(key)
  if (existingIndex >= 0) {
    nextSelectedKeys.splice(existingIndex, 1)
  } else {
    nextSelectedKeys.push(key)
  }

  emit('update:selectedKeys', nextSelectedKeys)
}

// action 事件中转。
function callAction(actionKey: string, caller: ActionCaller, node?: ITreeNode) {
  emit('action-called', { actionKey, caller, node })
}

function handleActionTrigger(payload: NodeTreeActionCalledPayload) {
  callAction(payload.actionKey, payload.caller, payload.node)
}

// 节点展开事件上抛。
function handleNodeToggle(node: ITreeNode, expanded: boolean) {
  emit('node-toggle', { node, expanded })
}

// 进入重命名状态。
function startNodeRename(node: ITreeNode) {
  if (!renameEnabled.value || node.renamable === false) {
    return
  }

  renamingNodeKey.value = node.key
  renameDraft.value = node.name
}

// 更新重命名草稿。
function updateRenameDraft(value: string) {
  renameDraft.value = value
}

// 取消重命名。
function cancelNodeRename() {
  renamingNodeKey.value = null
  renameDraft.value = ''
}

// 提交重命名。
function submitNodeRename(node: ITreeNode) {
  if (renamingNodeKey.value !== node.key) {
    return
  }

  const nextName = renameDraft.value
  cancelNodeRename()
  if (nextName === node.name) {
    return
  }

  emit('node-rename', {
    node,
    name: nextName,
  })
}

// 清空拖拽状态。
function clearDragState() {
  pendingDrag.value = null
  clearDropState()
}

// 清空落点状态。
function clearDropState() {
  dropTargetNode.value = null
  dropPosition.value = null
  dropAllowed.value = false
}

// 防止 drop 后误触发 click。
function markSuppressClick() {
  suppressClick.value = true
  window.setTimeout(() => {
    suppressClick.value = false
  }, 0)
}

// 记录节点按下起点，用于判定拖拽启动。
function handleNodePointerDown(node: ITreeNode, event: MouseEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target
  if (target instanceof HTMLElement && target.closest('button, [data-tree-interactive="true"]')) {
    return
  }

  pendingDrag.value = {
    node,
    startX: event.clientX,
    startY: event.clientY,
  }
}

// 达到阈值后进入拖拽状态。
function ensureDragging(event: MouseEvent) {
  if (draggedNode.value || !pendingDrag.value) {
    return
  }

  const distanceX = Math.abs(event.clientX - pendingDrag.value.startX)
  const distanceY = Math.abs(event.clientY - pendingDrag.value.startY)
  if (distanceX < 4 && distanceY < 4) {
    return
  }

  draggedNode.value = pendingDrag.value.node
  emit('drag-start', pendingDrag.value.node)
}

// 获取目标节点可接受的落点位置。
function getAllowedDropPositions(target: ITreeNode | null): NodeTreeDropPosition[] {
  if (props.allowedDropPositions) {
    return props.allowedDropPositions(target)
  }

  if (!target) {
    return ['inside']
  }

  return target.isExpandable ? ['before', 'inside', 'after'] : ['before', 'after']
}

// 写入当前落点并上抛 repositioning。
function setDropState(dragged: ITreeNode, target: ITreeNode | null, position: NodeTreeDropPosition, canDrop: boolean) {
  dropTargetNode.value = target
  dropPosition.value = position
  dropAllowed.value = canDrop

  emit('repositioning', {
    dragged,
    target,
    position,
    canDrop,
  })
}

// 节点区域悬停时更新落点。
function handleNodePointerOver(target: ITreeNode, position: NodeTreeDropPosition) {
  const dragged = draggedNode.value
  if (!dragged) {
    return false
  }

  const allowedDropPositions = getAllowedDropPositions(target)
  if (!allowedDropPositions.includes(position)) {
    clearDropState()
    return false
  }

  const canDrop = dragged.key !== target.key && (props.canDrop?.({ dragged, target, position }) ?? true)
  setDropState(dragged, target, position, canDrop)
  return canDrop
}

// 根区域悬停时更新落点。
function handleRootPointerMove() {
  const dragged = draggedNode.value
  if (!dragged) {
    return false
  }

  const allowedDropPositions = getAllowedDropPositions(null)
  if (!allowedDropPositions.includes('inside')) {
    clearDropState()
    return false
  }

  const position: NodeTreeDropPosition = 'inside'
  const canDrop = props.canDrop?.({ dragged, target: null, position }) ?? true
  setDropState(dragged, null, position, canDrop)
  return canDrop
}

// 结束拖拽并上抛 drag-end。
function handleNodeDragEnd() {
  const dragged = draggedNode.value
  clearDragState()
  draggedNode.value = null

  if (dragged) {
    emit('drag-end', dragged)
  }
}

// 全局鼠标移动：驱动拖拽命中计算。
function handleGlobalMouseMove(event: MouseEvent) {
  ensureDragging(event)
  if (!draggedNode.value) {
    return
  }

  const hoveredElement = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  if (!hoveredElement) {
    clearDropState()
    return
  }

  const hoveredNodeElement = hoveredElement.closest<HTMLElement>('[data-tree-node-key]')
  if (hoveredNodeElement) {
    const nodeKey = hoveredNodeElement.dataset.treeNodeKey
    const hoveredNode = nodeKey ? (nodeMap.value.get(nodeKey) ?? null) : null
    if (!hoveredNode) {
      clearDropState()
      return
    }

    const allowedDropPositions = getAllowedDropPositions(hoveredNode)
    if (allowedDropPositions.length === 0) {
      clearDropState()
      return
    }

    const rect = hoveredNodeElement.getBoundingClientRect()
    const offsetY = event.clientY - rect.top
    let position: NodeTreeDropPosition
    if (allowedDropPositions.length === 1) {
      position = allowedDropPositions[0]
    } else if (!allowedDropPositions.includes('inside')) {
      position = offsetY < rect.height / 2 ? 'before' : 'after'
    } else {
      position = offsetY <= rect.height * 0.3 ? 'before' : (offsetY >= rect.height * 0.7 ? 'after' : 'inside')
    }

    handleNodePointerOver(hoveredNode, position)
    return
  }

  if (treeRootElement.value?.contains(hoveredElement)) {
    handleRootPointerMove()
    return
  }

  clearDropState()
}

// 全局鼠标释放：必要时触发 node-drop。
function handleGlobalMouseUp() {
  const dragged = draggedNode.value
  const target = dropTargetNode.value
  const position = dropPosition.value
  const canDrop = dropAllowed.value

  if (dragged && position && canDrop) {
    emit('node-drop', {
      dragged,
      target,
      position,
    })
    markSuppressClick()
  }

  handleNodeDragEnd()
}

// 组件挂载时注册全局拖拽监听。
onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})

// 组件卸载时移除全局拖拽监听。
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})

// 向 TreeNode 注入统一上下文协议。
provide('nodeTree', {
  selectedKeys,
  selectedKeySet,
  handleNodeClick,
  handleNodeDoubleClick,
  handleNodeToggle,
  callAction,
  suppressClick,
  handleNodePointerDown,
  draggedNode,
  dropTargetNode,
  dropPosition,
  dropAllowed,
  actions: computed(() => props.actions),
  renameEnabled,
  renamingNodeKey,
  renameDraft,
  startNodeRename,
  updateRenameDraft,
  cancelNodeRename,
  submitNodeRename,
} satisfies NodeTreeContext)

// 根标题点击：切换根展开。
function handleClick() {
  cancelNodeRename()
  const nextExpanded = !treeExpanded.value

  if (!isRootExpandedControlled.value) {
    treeExpanded.value = nextExpanded
  }

  emit('update:expanded', nextExpanded)
}
</script>

<style scoped>
.node-tree {
  user-select: none;
}

.node-tree.dragging {
  cursor: grabbing;
}

.node-tree.drag-over-root .root-content,
.node-tree.drag-over-root .tree-children {
  box-shadow: inset 0 0 0 1px var(--oc-bg-accent);
}

.node-tree.drag-over-root.drop-invalid .root-content,
.node-tree.drag-over-root.drop-invalid .tree-children {
  box-shadow: inset 0 0 0 1px var(--oc-danger);
}

.root-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  cursor: pointer;
  font-size: 13px;
}

.root-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: bold;
}

.root-actions {
  display: flex;
  visibility: hidden;
  gap: 2px;
  margin-right: 4px;
}

.node-tree:hover .root-actions {
  visibility: visible;
}
</style>
