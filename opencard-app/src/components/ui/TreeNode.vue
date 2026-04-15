<template>
  <div class="tree-node" :class="treeNodeClass">
    <div class="node-content" :class="nodeContentClass" :style="{ paddingLeft: `${level * 12}px` }"
      :data-tree-node-key="props.node.key" @click="handleClick" @dblclick="handleDoubleClick" @mousedown="handleMouseDown">
      <i v-if="isExpandable" class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
        data-tree-interactive="true" @mousedown.stop @click.stop="handleToggleClick" />
      <AppIcon :name="node.icon || 'file.default'" :tone="node.iconTone" :color="node.iconColor" />
      <span
        v-if="!isRenaming"
        class="node-name node-name-label"
        @click.stop="handleNameClick"
        @dblclick.stop
      >
        {{ node.name }}
      </span>
      <OcFieldInput
        v-else
        ref="renameInputElement"
        class="node-name node-rename-input"
        type="text"
        :value="nodeTree?.renameDraft.value ?? ''"
        data-tree-interactive="true"
        @mousedown.stop
        @dblclick.stop
        @click.stop
        @input="handleRenameInput"
        @keydown="handleRenameKeydown"
        @blur="handleRenameBlur"
      />
      <div v-if="availableActions.length" class="node-actions">
        <TreeActionButton
          v-for="action in availableActions"
          :key="action.key"
          :action="action"
          caller="node"
          :node="props.node"
          @trigger="handleActionTrigger"
        />
      </div>
    </div>

    <div v-if="isExpandable && isExpanded" class="node-children" :class="childrenClass">
      <TreeNode v-for="child in node.children" :key="child.key" :node="child" :level="level + 1" />
    </div>
  </div>
</template>

<script lang="ts">
import type { IconTone } from '../../core/icons/iconRegistry'

export interface ITreeNode {
  name: string
  key: string
  path?: string[]
  renamable?: boolean
  isExpandable?: boolean
  isExpanded?: boolean
  icon?: string
  iconTone?: IconTone
  iconColor?: string
  parent?: ITreeNode | null
  children?: ITreeNode[]
  metadata?: Record<string, any>
  actionKeys?: string[]
}
</script>

<script setup lang="ts">
import { computed, inject, nextTick, ref, watch, type ComputedRef } from 'vue'
import AppIcon from './AppIcon.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import TreeActionButton from './TreeActionButton.vue'
import type { ActionDefinition, ActionCaller, NodeTreeDropPosition } from './NodeTree.vue'

const props = defineProps<{
  node: ITreeNode
  level: number
}>()

const nodeTree = inject<{
  selectedNodes: ComputedRef<Map<string, ITreeNode>>
  handleNodeClick: (key: string, node: ITreeNode, modify: 'ctrl' | 'none') => void
  handleNodeDoubleClick: (node: ITreeNode) => void
  handleNodeToggle: (node: ITreeNode, expanded: boolean) => void
  callAction: (actionKey: string, caller: ActionCaller, node?: ITreeNode) => void
  suppressClick: { value: boolean }
  handleNodePointerDown: (node: ITreeNode, event: MouseEvent) => void
  draggedNode: { value: ITreeNode | null }
  dropTargetNode: { value: ITreeNode | null }
  dropPosition: { value: NodeTreeDropPosition | null }
  dropAllowed: { value: boolean }
  handleNodePointerOver: (node: ITreeNode, position: NodeTreeDropPosition) => boolean
  handleNodeDragEnd: () => void
  actions: ComputedRef<Map<string, ActionDefinition>>
  multiSelect: boolean
  defaultNodeExpanded: boolean
  renameEnabled: boolean
  renamingNodeKey: { value: string | null }
  renameDraft: { value: string }
  startNodeRename: (node: ITreeNode) => void
  updateRenameDraft: (value: string) => void
  cancelNodeRename: () => void
  submitNodeRename: (node: ITreeNode) => void
}>('nodeTree')

const availableActions = computed(() => {
  if (!props.node.actionKeys || props.node.actionKeys.length === 0) return []
  return props.node.actionKeys
    .map((key) => nodeTree?.actions.value.get(key))
    .filter((action): action is ActionDefinition => action !== undefined)
})

const isSelected = computed(() => {
  return nodeTree?.selectedNodes.value.has(props.node.key) || false
})

const isOnlySelected = computed(() => {
  return nodeTree?.selectedNodes.value.size === 1 && isSelected.value
})

const isRenamable = computed(() => {
  return props.node.renamable !== false && (nodeTree?.renameEnabled ?? false)
})

const isRenaming = computed(() => {
  return nodeTree?.renamingNodeKey.value === props.node.key
})

const isExpandable = computed(() => {
  if (props.node.isExpandable === true) return true
  if (props.node.isExpandable === false) return false
  return Boolean(props.node.children?.length)
})

const dropState = computed(() => {
  const isActiveTarget = nodeTree?.dropTargetNode.value?.key === props.node.key
  return {
    isDragging: nodeTree?.draggedNode.value?.key === props.node.key,
    isActiveTarget,
    position: isActiveTarget ? nodeTree?.dropPosition.value ?? null : null,
    allowed: isActiveTarget ? nodeTree?.dropAllowed.value ?? false : false,
  }
})

const nodeContentClass = computed(() => ({
  selected: isSelected.value,
  dragging: dropState.value.isDragging,
  'drop-before': dropState.value.isActiveTarget && dropState.value.position === 'before',
  'drop-inside': dropState.value.isActiveTarget && dropState.value.position === 'inside',
  'drop-after': dropState.value.isActiveTarget && dropState.value.position === 'after',
  'drop-invalid': dropState.value.isActiveTarget && !dropState.value.allowed,
}))

const treeNodeClass = computed(() => ({
  'drop-inside-target': dropState.value.isActiveTarget && dropState.value.position === 'inside' && dropState.value.allowed,
  'drop-inside-invalid': dropState.value.isActiveTarget && dropState.value.position === 'inside' && !dropState.value.allowed,
}))

const childrenClass = computed(() => ({
  'drop-inside-children': dropState.value.isActiveTarget && dropState.value.position === 'inside' && dropState.value.allowed,
  'drop-inside-children-invalid': dropState.value.isActiveTarget && dropState.value.position === 'inside' && !dropState.value.allowed,
}))

const uncontrolledExpanded = ref(props.node.isExpanded ?? nodeTree?.defaultNodeExpanded ?? false)
const isExpandedControlled = computed(() => props.node.isExpanded !== undefined)
const isExpanded = computed(() => {
  return isExpandedControlled.value ? props.node.isExpanded ?? false : uncontrolledExpanded.value
})
const renameInputElement = ref<{ $el?: Element | null } | null>(null)

watch(
  () => props.node.isExpanded,
  (nextExpanded) => {
    if (nextExpanded === undefined) {
      return
    }

    uncontrolledExpanded.value = nextExpanded
  },
)

watch(
  isRenaming,
  async (nextIsRenaming) => {
    if (!nextIsRenaming) {
      return
    }

    await nextTick()
    const inputElement = renameInputElement.value?.$el
    if (!(inputElement instanceof HTMLInputElement)) {
      return
    }

    inputElement.focus()
    inputElement.select()
  },
)

function handleToggleClick() {
  if (!isExpandedControlled.value) {
    uncontrolledExpanded.value = !isExpanded.value
  }

  nodeTree?.handleNodeToggle(props.node, !isExpanded.value)
}

function handleClick(event: MouseEvent) {
  event.stopPropagation()
  if (nodeTree?.suppressClick.value) {
    return
  }

  const modify = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'

  nodeTree?.handleNodeClick(props.node.key, props.node, modify)
}

function handleNameClick(event: MouseEvent) {
  event.stopPropagation()
  if (nodeTree?.suppressClick.value) {
    return
  }

  const modify = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'
  if (modify === 'none' && isOnlySelected.value && isRenamable.value) {
    nodeTree?.startNodeRename(props.node)
    return
  }

  nodeTree?.handleNodeClick(props.node.key, props.node, modify)
}

function handleDoubleClick(event: MouseEvent) {
  event.stopPropagation()
  nodeTree?.handleNodeDoubleClick(props.node)
}

function handleActionTrigger(payload: { actionKey: string; caller: ActionCaller; node?: ITreeNode }) {
  nodeTree?.callAction(payload.actionKey, payload.caller, payload.node)
}

function handleMouseDown(event: MouseEvent) {
  event.stopPropagation()
  nodeTree?.handleNodePointerDown(props.node, event)
}

function handleRenameInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }

  nodeTree?.updateRenameDraft(target.value)
}

function handleRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    nodeTree?.submitNodeRename(props.node)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    nodeTree?.cancelNodeRename()
  }
}

function handleRenameBlur() {
  nodeTree?.cancelNodeRename()
}

</script>

<style scoped>
.tree-node {
  user-select: none;
}

.tree-node.drop-inside-target {
  background: linear-gradient(180deg, var(--oc-bg-accent-tint-strong), var(--oc-bg-accent-tint-soft));
  border-radius: 4px;
}

.tree-node.drop-inside-invalid {
  background: linear-gradient(180deg, var(--oc-bg-danger-tint-strong), var(--oc-bg-danger-tint-soft));
  border-radius: 4px;
}

.node-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 13px;
}

.node-content:hover {
  background: var(--oc-bg-hover);
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-name-label {
  min-width: 0;
}

.node-rename-input {
  min-width: 0;
  width: 100%;
}

.node-content.selected {
  background: var(--oc-bg-selected);
}

.node-content.dragging {
  opacity: 0.45;
}

.node-content.drop-before {
  box-shadow: inset 0 2px 0 var(--oc-bg-accent);
}

.node-content.drop-inside {
  background: var(--oc-bg-accent-soft);
}

.node-content.drop-after {
  box-shadow: inset 0 -2px 0 var(--oc-bg-accent);
}

.node-content.drop-invalid {
  box-shadow: inset 0 0 0 1px var(--oc-danger);
}

.node-children.drop-inside-children {
  box-shadow: inset 1px 0 0 rgba(14, 99, 156, 0.75);
  background: var(--oc-bg-accent-tint-subtle);
}

.node-children.drop-inside-children-invalid {
  box-shadow: inset 1px 0 0 rgba(241, 76, 76, 0.8);
  background: var(--oc-bg-danger-tint-subtle);
}

.node-content.focused {
  background: var(--oc-bg-active);
}

.codicon {
  flex-shrink: 0;
}

.node-actions {
  display: flex;
  visibility: hidden;
  gap: 2px;
  margin-right: 4px;
}

.node-content:hover .node-actions,
.node-actions:hover {
  visibility: visible;
}
</style>
