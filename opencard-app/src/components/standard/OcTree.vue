<!-- Standard 树组件：统一树浏览、选择、重命名、拖拽与动作菜单协议，默认仅启用基础浏览。 -->
<template>
  <div ref="treeRootElement" class="oc-tree" role="tree" :aria-label="props.title" :class="{
    'is-fill': props.fill,
    'drag-over-root': draggedNode && !dropTargetNode && dropPosition,
    'drop-invalid': draggedNode && !dropTargetNode && dropPosition && !dropAllowed,
    dragging: draggedNode,
  }">
    <div class="oc-tree__root" role="button" tabindex="0" :aria-expanded="isRootExpanded" @click="handleRootClick"
      @keydown="handleRootKeydown">
      <OcIcon :name="isRootExpanded ? 'icon.chevron-down' : 'icon.chevron-right'" size="sm" />
      <span class="oc-tree__root-title">{{ props.title }}</span>
      <div v-if="enableActions && treeActions.length" class="oc-tree__root-actions">
        <OcButton v-for="action in treeActions" :key="action.key" class="oc-tree__action-button" variant="ghost"
          icon-only :icon="action.icon" :title="action.title" data-tree-interactive="true" @mousedown.stop
          @click.stop="handleActionClick(action, 'tree', undefined, $event)" />
      </div>
    </div>

    <div v-if="isRootExpanded" class="oc-tree__children" role="group">
      <div v-for="entry in visibleNodes" :key="entry.node.key" class="oc-tree__node"
        :class="resolveNodeContainerClass(entry.node)">
        <div class="oc-tree__node-content" :class="resolveNodeContentClass(entry.node)"
          :style="{ paddingLeft: `${entry.level * 12}px` }" :data-tree-node-key="entry.node.key" role="treeitem"
          tabindex="0" :aria-selected="isSelected(entry.node) ? 'true' : 'false'"
          :aria-expanded="isExpandable(entry.node) ? isNodeExpanded(entry.node) : undefined"
          @click="handleNodeClick($event, entry.node)" @dblclick="handleNodeDoubleClick(entry.node, $event)"
          @mousedown="handleNodeMouseDown($event, entry.node)" @keydown="handleNodeKeydown($event, entry.node)">
          <OcIcon v-if="isExpandable(entry.node)" class="oc-tree__chevron"
            :name="isNodeExpanded(entry.node) ? 'tree.chevronDown' : 'tree.chevronRight'" size="sm"
            data-tree-interactive="true" @mousedown.stop @click.stop="toggleNodeExpanded(entry.node)" />
          <OcIcon v-else :name="entry.node.icon || 'file.default'" :tone="entry.node.iconTone" />

          <span v-if="renamingNodeKey !== entry.node.key" class="oc-tree__node-name"
            @click.stop="handleNodeNameClick($event, entry.node)" @dblclick.stop>
            {{ entry.node.name }}
          </span>

          <OcFieldInput v-else as="input" class="oc-tree__rename-input" type="text" :value="renameDraft"
            :data-tree-rename-input="entry.node.key" data-tree-interactive="true" @mousedown.stop @dblclick.stop
            @click.stop @input="handleRenameInput" @keydown="handleRenameKeydown($event, entry.node)"
            @blur="cancelNodeRename" />

          <div v-if="enableActions && resolveNodeActions(entry.node).length" class="oc-tree__node-actions">
            <OcButton v-for="action in resolveNodeActions(entry.node)" :key="action.key" class="oc-tree__action-button"
              variant="ghost" icon-only :icon="action.icon" :title="action.title" data-tree-interactive="true"
              @mousedown.stop @click.stop="handleActionClick(action, 'node', entry.node, $event)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useFloatingMenu, type FloatingMenuItem } from '../../composables/useFloatingMenu'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import type {
  ActionCaller,
  ActionDefinition,
  ITreeNode,
  NodeTreeActionCalledPayload,
  NodeTreeAllowedDropPositions,
  NodeTreeCanDropPayload,
  NodeTreeDropPayload,
  NodeTreeDropPosition,
  NodeTreeRenamePayload,
  NodeTreeRepositioningPayload,
  NodeTreeTogglePayload,
} from '../../shared/ui/tree/tree.types'

type OcTreeFeature = 'rename' | 'drag-drop' | 'actions'

type OcTreeVisibleNode = {
  node: ITreeNode
  level: number
}

interface OcTreeProps {
  /** 树节点列表。 */
  nodes: ITreeNode[]
  /** 是否启用多选。 */
  multiSelect?: boolean
  /** 当前选中 key 列表。 */
  selectedKeys?: string[]
  /** 根节点标题。 */
  title?: string
  /** 根节点是否展开（受控）。 */
  expanded?: boolean
  /** 动作字典。 */
  actions?: Map<string, ActionDefinition>
  /** 根节点动作 key 列表。 */
  actionKeys?: string[]
  /** 拖拽落点校验函数。 */
  canDrop?: (payload: NodeTreeCanDropPayload) => boolean
  /** 目标节点可用落点函数。 */
  allowedDropPositions?: NodeTreeAllowedDropPositions
  /** 启用的高级能力。 */
  features?: readonly OcTreeFeature[]
  /** 是否占满父容器。 */
  fill?: boolean
}

interface OcTreeEmits {
  /** 选中列表变化时抛出。 */
  'update:selectedKeys': [value: string[]]
  /** 根展开态变化时抛出。 */
  'update:expanded': [value: boolean]
  /** 节点双击时抛出。 */
  'node-dblclick': [node: ITreeNode]
  /** 节点展开态变化时抛出。 */
  'node-toggle': [payload: NodeTreeTogglePayload]
  /** 节点重命名时抛出。 */
  'node-rename': [payload: NodeTreeRenamePayload]
  /** 节点动作触发时抛出。 */
  'node-action': [payload: NodeTreeActionCalledPayload]
  /** 拖拽开始时抛出。 */
  'drag-start': [node: ITreeNode]
  /** 拖拽结束时抛出。 */
  'drag-end': [node: ITreeNode]
  /** 拖拽悬停重定位时抛出。 */
  repositioning: [payload: NodeTreeRepositioningPayload]
  /** 放置完成时抛出。 */
  'node-drop': [payload: NodeTreeDropPayload]
}

defineOptions({
  name: 'OcTree',
})

const props = withDefaults(defineProps<OcTreeProps>(), {
  multiSelect: true,
  selectedKeys: () => [],
  title: undefined,
  expanded: undefined,
  actions: () => new Map<string, ActionDefinition>(),
  actionKeys: () => [],
  canDrop: undefined,
  allowedDropPositions: undefined,
  features: () => [],
  fill: false,
})

const emit = defineEmits<OcTreeEmits>()
const { openMenu } = useFloatingMenu()

const treeRootElement = ref<HTMLDivElement | null>(null)
const treeExpanded = ref(props.expanded ?? false)
const nodeExpandedState = ref(new Map<string, boolean>())
const renamingNodeKey = ref<string | null>(null)
const renameDraft = ref('')
const suppressClick = ref(false)
const pendingDrag = ref<{ node: ITreeNode; startX: number; startY: number } | null>(null)
const draggedNode = ref<ITreeNode | null>(null)
const dropTargetNode = ref<ITreeNode | null>(null)
const dropPosition = ref<NodeTreeDropPosition | null>(null)
const dropAllowed = ref(false)

const instance = getCurrentInstance()
const vnodeProps = computed(() => (instance?.vnode.props ?? {}) as Record<string, unknown>)
const featureSet = computed(() => new Set(props.features))
const enableActions = computed(() => featureSet.value.has('actions'))
const enableRename = computed(() => featureSet.value.has('rename'))
const enableDragDrop = computed(() => featureSet.value.has('drag-drop'))
const renameEnabled = computed(() =>
  enableRename.value && Boolean(vnodeProps.value.onNodeRename || vnodeProps.value.onNodeRenameOnce),
)

const isRootExpandedControlled = computed(() => props.expanded !== undefined)
const isRootExpanded = computed(() => treeExpanded.value)
const selectedKeySet = computed(() => new Set(props.selectedKeys))
const treeActions = computed(() =>
  props.actionKeys
    .map((key) => props.actions.get(key))
    .filter((action): action is ActionDefinition => action !== undefined),
)

watch(
  () => props.expanded,
  (nextExpanded) => {
    if (nextExpanded === undefined) {
      return
    }
    treeExpanded.value = nextExpanded
  },
)

watch(
  () => props.selectedKeys,
  (nextSelectedKeys) => {
    if (!renamingNodeKey.value) {
      return
    }

    if (nextSelectedKeys.length !== 1 || !nextSelectedKeys.includes(renamingNodeKey.value)) {
      cancelNodeRename()
    }
  },
)

watch(
  renamingNodeKey,
  async (nextKey) => {
    if (!nextKey) {
      return
    }

    await nextTick()
    const inputElement = treeRootElement.value?.querySelector<HTMLInputElement>(`[data-tree-rename-input="${nextKey}"]`)
    inputElement?.focus()
    inputElement?.select()
  },
)

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

const visibleNodes = computed<OcTreeVisibleNode[]>(() => {
  if (!isRootExpanded.value) {
    return []
  }

  const flattened: OcTreeVisibleNode[] = []
  const visit = (nodes: ITreeNode[], level: number) => {
    for (const node of nodes) {
      flattened.push({ node, level })
      if (isExpandable(node) && isNodeExpanded(node) && node.children?.length) {
        visit(node.children, level + 1)
      }
    }
  }

  visit(props.nodes, 1)
  return flattened
})

function isSelected(node: ITreeNode): boolean {
  return selectedKeySet.value.has(node.key)
}

function isOnlySelected(node: ITreeNode): boolean {
  return props.selectedKeys.length === 1 && isSelected(node)
}

function isExpandable(node: ITreeNode): boolean {
  if (node.isExpandable === true) return true
  if (node.isExpandable === false) return false
  return Boolean(node.children?.length)
}

function isNodeExpanded(node: ITreeNode): boolean {
  if (node.isExpanded !== undefined) {
    return Boolean(node.isExpanded)
  }

  const stored = nodeExpandedState.value.get(node.key)
  return stored ?? true
}

function setNodeExpanded(node: ITreeNode, expanded: boolean): void {
  if (node.isExpanded !== undefined) {
    return
  }

  nodeExpandedState.value.set(node.key, expanded)
}

function toggleNodeExpanded(node: ITreeNode): void {
  if (!isExpandable(node)) {
    return
  }

  const nextExpanded = !isNodeExpanded(node)
  setNodeExpanded(node, nextExpanded)
  emit('node-toggle', { node, expanded: nextExpanded })
}

function resolveNodeActions(node: ITreeNode): ActionDefinition[] {
  if (!node.actionKeys || node.actionKeys.length === 0) {
    return []
  }

  return node.actionKeys
    .map((key) => props.actions.get(key))
    .filter((action): action is ActionDefinition => action !== undefined)
}

function toFloatingMenuItems(actions: ActionDefinition[]): FloatingMenuItem[] {
  return actions.map((action) => ({
    key: action.key,
    label: action.title ?? action.key,
    icon: action.icon,
    children: action.children ? toFloatingMenuItems(action.children) : undefined,
  }))
}

function emitNodeAction(actionKey: string, caller: ActionCaller, node?: ITreeNode): void {
  emit('node-action', {
    actionKey,
    caller,
    node,
  })
}

function handleActionClick(
  action: ActionDefinition,
  caller: ActionCaller,
  node: ITreeNode | undefined,
  event: MouseEvent,
): void {
  if (!enableActions.value) {
    return
  }

  if (action.children?.length) {
    const anchor = event.currentTarget
    if (!(anchor instanceof HTMLElement)) {
      return
    }

    openMenu({
      anchor,
      items: toFloatingMenuItems(action.children),
      placement: 'bottom-end',
      onSelect: (actionKey) => emitNodeAction(actionKey, caller, node),
    })
    return
  }

  emitNodeAction(action.key, caller, node)
}

function handleRootClick(): void {
  cancelNodeRename()
  const nextExpanded = !treeExpanded.value

  if (!isRootExpandedControlled.value) {
    treeExpanded.value = nextExpanded
  }

  emit('update:expanded', nextExpanded)
}

function handleRootKeydown(event: KeyboardEvent): void {
  if (event.target !== event.currentTarget) {
    return
  }

  if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
    return
  }

  event.preventDefault()
  handleRootClick()
}

function updateSelectedKeys(nextSelectedKeys: string[]): void {
  emit('update:selectedKeys', nextSelectedKeys)
}

function selectNode(node: ITreeNode, modify: 'ctrl' | 'none'): void {
  if (!props.multiSelect || modify === 'none') {
    updateSelectedKeys([node.key])
    return
  }

  const nextSelectedKeys = [...new Set(props.selectedKeys)]
  const existingIndex = nextSelectedKeys.indexOf(node.key)
  if (existingIndex >= 0) {
    nextSelectedKeys.splice(existingIndex, 1)
  } else {
    nextSelectedKeys.push(node.key)
  }

  updateSelectedKeys(nextSelectedKeys)
}

function handleNodeClick(event: MouseEvent, node: ITreeNode): void {
  event.stopPropagation()
  if (suppressClick.value) {
    return
  }

  if (renamingNodeKey.value && renamingNodeKey.value !== node.key) {
    cancelNodeRename()
  }

  const modify: 'ctrl' | 'none' = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'
  selectNode(node, modify)
}

function handleNodeNameClick(event: MouseEvent, node: ITreeNode): void {
  event.stopPropagation()
  if (suppressClick.value) {
    return
  }

  const modify: 'ctrl' | 'none' = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'
  if (modify === 'none' && isOnlySelected(node) && renameEnabled.value && node.renamable !== false) {
    startNodeRename(node)
    return
  }

  selectNode(node, modify)
}

function handleNodeDoubleClick(node: ITreeNode, event: MouseEvent): void {
  event.stopPropagation()
  emit('node-dblclick', node)
}

function startNodeRename(node: ITreeNode): void {
  if (!renameEnabled.value || node.renamable === false) {
    return
  }

  renamingNodeKey.value = node.key
  renameDraft.value = node.name
}

function cancelNodeRename(): void {
  renamingNodeKey.value = null
  renameDraft.value = ''
}

function handleRenameInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  renameDraft.value = target.value
}

function submitNodeRename(node: ITreeNode): void {
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

function handleRenameKeydown(event: KeyboardEvent, node: ITreeNode): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    submitNodeRename(node)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    cancelNodeRename()
  }
}

function handleNodeKeydown(event: KeyboardEvent, node: ITreeNode): void {
  if (event.target !== event.currentTarget) {
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    const modify: 'ctrl' | 'none' = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'
    selectNode(node, modify)
    return
  }

  if (event.key === 'ArrowRight' && isExpandable(node) && !isNodeExpanded(node)) {
    event.preventDefault()
    toggleNodeExpanded(node)
    return
  }

  if (event.key === 'ArrowLeft' && isExpandable(node) && isNodeExpanded(node)) {
    event.preventDefault()
    toggleNodeExpanded(node)
    return
  }

  if (event.key === 'F2' && isOnlySelected(node) && renameEnabled.value && node.renamable !== false) {
    event.preventDefault()
    startNodeRename(node)
  }
}

function handleNodeMouseDown(event: MouseEvent, node: ITreeNode): void {
  event.stopPropagation()
  if (!enableDragDrop.value || event.button !== 0) {
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

function clearDropState(): void {
  dropTargetNode.value = null
  dropPosition.value = null
  dropAllowed.value = false
}

function clearDragState(): void {
  pendingDrag.value = null
  clearDropState()
}

function ensureDragging(event: MouseEvent): void {
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

function getAllowedDropPositions(target: ITreeNode | null): NodeTreeDropPosition[] {
  if (props.allowedDropPositions) {
    return props.allowedDropPositions(target)
  }

  if (!target) {
    return ['inside']
  }

  return target.isExpandable ? ['before', 'inside', 'after'] : ['before', 'after']
}

function setDropState(dragged: ITreeNode, target: ITreeNode | null, position: NodeTreeDropPosition, canDrop: boolean): void {
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

function markSuppressClick(): void {
  suppressClick.value = true
  window.setTimeout(() => {
    suppressClick.value = false
  }, 0)
}

function handleNodePointerOver(target: ITreeNode, position: NodeTreeDropPosition): void {
  const dragged = draggedNode.value
  if (!dragged) {
    return
  }

  const allowedDropPositions = getAllowedDropPositions(target)
  if (!allowedDropPositions.includes(position)) {
    clearDropState()
    return
  }

  const canDrop = dragged.key !== target.key && (props.canDrop?.({ dragged, target, position }) ?? true)
  setDropState(dragged, target, position, canDrop)
}

function handleRootPointerMove(): void {
  const dragged = draggedNode.value
  if (!dragged) {
    return
  }

  const allowedDropPositions = getAllowedDropPositions(null)
  if (!allowedDropPositions.includes('inside')) {
    clearDropState()
    return
  }

  const position: NodeTreeDropPosition = 'inside'
  const canDrop = props.canDrop?.({ dragged, target: null, position }) ?? true
  setDropState(dragged, null, position, canDrop)
}

function handleNodeDragEnd(): void {
  const dragged = draggedNode.value
  clearDragState()
  draggedNode.value = null

  if (dragged) {
    emit('drag-end', dragged)
  }
}

function handleGlobalMouseMove(event: MouseEvent): void {
  if (!enableDragDrop.value) {
    return
  }

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

function handleGlobalMouseUp(): void {
  if (!enableDragDrop.value) {
    return
  }

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

function resolveNodeContentClass(node: ITreeNode) {
  const isActiveTarget = dropTargetNode.value?.key === node.key
  return {
    selected: isSelected(node),
    dragging: draggedNode.value?.key === node.key,
    'drop-before': isActiveTarget && dropPosition.value === 'before',
    'drop-inside': isActiveTarget && dropPosition.value === 'inside',
    'drop-after': isActiveTarget && dropPosition.value === 'after',
    'drop-invalid': isActiveTarget && !dropAllowed.value,
  }
}

function resolveNodeContainerClass(node: ITreeNode) {
  const isActiveTarget = dropTargetNode.value?.key === node.key
  return {
    'drop-inside-target': isActiveTarget && dropPosition.value === 'inside' && dropAllowed.value,
    'drop-inside-invalid': isActiveTarget && dropPosition.value === 'inside' && !dropAllowed.value,
  }
}

onMounted(() => {
  window.addEventListener('mousemove', handleGlobalMouseMove)
  window.addEventListener('mouseup', handleGlobalMouseUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleGlobalMouseMove)
  window.removeEventListener('mouseup', handleGlobalMouseUp)
})
</script>

<style scoped>
.oc-tree {
  user-select: none;
}

.oc-tree.is-fill {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.oc-tree.is-fill .oc-tree__children {
  min-height: 0;
  overflow: auto;
  flex: 1 1 auto;
}

.oc-tree.dragging {
  cursor: grabbing;
}

.oc-tree.drag-over-root .oc-tree__root,
.oc-tree.drag-over-root .oc-tree__children {
  box-shadow: inset 0 0 0 1px var(--oc-bg-accent);
}

.oc-tree.drag-over-root.drop-invalid .oc-tree__root,
.oc-tree.drag-over-root.drop-invalid .oc-tree__children {
  box-shadow: inset 0 0 0 1px var(--oc-danger);
}

.oc-tree__root {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-1) 0;
  cursor: pointer;
  font-size: var(--oc-body-size);
}

.oc-tree__root:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}

.oc-tree__root-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
}

.oc-tree__root-actions {
  display: flex;
  visibility: hidden;
  gap: var(--oc-space-1);
  margin-right: var(--oc-space-1);
}

.oc-tree__root:hover .oc-tree__root-actions,
.oc-tree__root:focus-within .oc-tree__root-actions,
.oc-tree__root-actions:hover {
  visibility: visible;
}

.oc-tree__node {
  user-select: none;
}

.oc-tree__node.drop-inside-target {
  background: linear-gradient(180deg, var(--oc-bg-accent-tint-strong), var(--oc-bg-accent-tint-soft));
  border-radius: 4px;
}

.oc-tree__node.drop-inside-invalid {
  background: linear-gradient(180deg, var(--oc-bg-danger-tint-strong), var(--oc-bg-danger-tint-soft));
  border-radius: 4px;
}

.oc-tree__node-content {
  height: var(--oc-block-md);
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-1) var(--oc-space-2);
  cursor: pointer;
  font-size: var(--oc-body-size);
}

.oc-tree__node-content:hover {
  background: var(--oc-bg-hover);
}

.oc-tree__node-content:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: -1px;
}

.oc-tree__node-content.selected {
  background: var(--oc-bg-selected);
}

.oc-tree__node-content.dragging {
  opacity: 0.45;
}

.oc-tree__node-content.drop-before {
  box-shadow: inset 0 2px 0 var(--oc-bg-accent);
}

.oc-tree__node-content.drop-inside {
  background: var(--oc-bg-accent-soft);
}

.oc-tree__node-content.drop-after {
  box-shadow: inset 0 -2px 0 var(--oc-bg-accent);
}

.oc-tree__node-content.drop-invalid {
  box-shadow: inset 0 0 0 1px var(--oc-danger);
}

.oc-tree__chevron {
  flex-shrink: 0;
}

.oc-tree__node-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.oc-tree__rename-input {
  min-width: 0;
  width: 100%;
}

.oc-tree__node-actions {
  display: flex;
  visibility: hidden;
  gap: var(--oc-space-1);
  margin-right: var(--oc-space-1);
}

.oc-tree__node-content:hover .oc-tree__node-actions,
.oc-tree__node-content:focus-within .oc-tree__node-actions,
.oc-tree__node-actions:hover {
  visibility: visible;
}
</style>
