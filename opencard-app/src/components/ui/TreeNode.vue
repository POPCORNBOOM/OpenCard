<!--
  使用说明：
  - 仅作为 NodeTree 的子节点渲染单元使用，不应独立挂载。
  - 输入为 `node` 与 `level`，其余交互能力由 NodeTree 注入。

  职责边界：
  - 负责节点 UI 呈现与交互转发（选中、展开、重命名输入、拖拽态）。
  - 不承载业务规则；领域判断与数据落地必须由外层模块处理。
-->
<template>
  <div class="tree-node" :class="treeNodeClass">
    <div
      class="node-content"
      :class="nodeContentClass"
      :style="{ paddingLeft: `${level * 12}px` }"
      :data-tree-node-key="props.node.key"
      @click="handleClick"
      @dblclick="handleDoubleClick"
      @mousedown="handleMouseDown"
    >
      <i
        v-if="isExpandable"
        class="codicon"
        :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
        data-tree-interactive="true"
        @mousedown.stop
        @click.stop="handleToggleClick"
      />
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
        :value="nodeTree.renameDraft.value"
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
// Tree 节点通用数据结构。
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
  metadata?: Record<string, unknown>
  actionKeys?: string[]
}
</script>

<script setup lang="ts">
// Vue 能力与依赖组件。
import { computed, inject, nextTick, ref, watch } from 'vue'
import AppIcon from './AppIcon.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import TreeActionButton from './TreeActionButton.vue'
import type { ActionDefinition, ActionCaller, NodeTreeContext } from './NodeTree.vue'

// 当前节点输入。
const props = defineProps<{
  node: ITreeNode
  level: number
}>()

// 注入上层 NodeTree 交互上下文。
const injectedNodeTree = inject<NodeTreeContext>('nodeTree')
if (!injectedNodeTree) {
  throw new Error('TreeNode must be used inside NodeTree.')
}
const nodeTree = injectedNodeTree

// 节点可见操作列表。
const availableActions = computed(() => {
  if (!props.node.actionKeys || props.node.actionKeys.length === 0) {
    return []
  }

  return props.node.actionKeys
    .map((key) => nodeTree.actions.value.get(key))
    .filter((action): action is ActionDefinition => action !== undefined)
})

// 节点选择与重命名状态。
const isSelected = computed(() => nodeTree.selectedKeySet.value.has(props.node.key))
const isOnlySelected = computed(() => nodeTree.selectedKeys.value.length === 1 && isSelected.value)
const isRenamable = computed(() => props.node.renamable !== false && nodeTree.renameEnabled.value)
const isRenaming = computed(() => nodeTree.renamingNodeKey.value === props.node.key)

// 节点是否可展开。
const isExpandable = computed(() => {
  if (props.node.isExpandable === true) return true
  if (props.node.isExpandable === false) return false
  return Boolean(props.node.children?.length)
})

// 拖拽命中状态。
const dropState = computed(() => {
  const isActiveTarget = nodeTree.dropTargetNode.value?.key === props.node.key
  return {
    isDragging: nodeTree.draggedNode.value?.key === props.node.key,
    isActiveTarget,
    position: isActiveTarget ? nodeTree.dropPosition.value ?? null : null,
    allowed: isActiveTarget ? nodeTree.dropAllowed.value : false,
  }
})

// 节点内容动态样式。
const nodeContentClass = computed(() => ({
  selected: isSelected.value,
  dragging: dropState.value.isDragging,
  'drop-before': dropState.value.isActiveTarget && dropState.value.position === 'before',
  'drop-inside': dropState.value.isActiveTarget && dropState.value.position === 'inside',
  'drop-after': dropState.value.isActiveTarget && dropState.value.position === 'after',
  'drop-invalid': dropState.value.isActiveTarget && !dropState.value.allowed,
}))

// 节点容器动态样式。
const treeNodeClass = computed(() => ({
  'drop-inside-target': dropState.value.isActiveTarget && dropState.value.position === 'inside' && dropState.value.allowed,
  'drop-inside-invalid': dropState.value.isActiveTarget && dropState.value.position === 'inside' && !dropState.value.allowed,
}))

// 子节点容器动态样式。
const childrenClass = computed(() => ({
  'drop-inside-children': dropState.value.isActiveTarget && dropState.value.position === 'inside' && dropState.value.allowed,
  'drop-inside-children-invalid': dropState.value.isActiveTarget && dropState.value.position === 'inside' && !dropState.value.allowed,
}))

// 展开状态（支持受控/非受控）。
const localExpanded = ref(props.node.isExpanded ?? true)
const isExpandedControlled = computed(() => props.node.isExpanded !== undefined)
const isExpanded = computed(() => {
  if (isExpandedControlled.value) {
    return Boolean(props.node.isExpanded)
  }
  return localExpanded.value
})

// 重命名输入引用。
const renameInputElement = ref<{ $el?: Element | null } | null>(null)

// 受控展开值同步。
watch(
  () => props.node.isExpanded,
  (nextExpanded) => {
    if (nextExpanded === undefined) {
      return
    }
    localExpanded.value = nextExpanded
  },
)

// 进入重命名时自动聚焦输入框。
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

// 点击折叠箭头。
function handleToggleClick() {
  const nextExpanded = !isExpanded.value
  if (!isExpandedControlled.value) {
    localExpanded.value = nextExpanded
  }

  nodeTree.handleNodeToggle(props.node, nextExpanded)
}

// 点击节点正文。
function handleClick(event: MouseEvent) {
  event.stopPropagation()
  if (nodeTree.suppressClick.value) {
    return
  }

  const modify: 'ctrl' | 'none' = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'
  nodeTree.handleNodeClick(props.node.key, props.node, modify)
}

// 点击节点名称（支持单选后进入重命名）。
function handleNameClick(event: MouseEvent) {
  event.stopPropagation()
  if (nodeTree.suppressClick.value) {
    return
  }

  const modify: 'ctrl' | 'none' = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'
  if (modify === 'none' && isOnlySelected.value && isRenamable.value) {
    nodeTree.startNodeRename(props.node)
    return
  }

  nodeTree.handleNodeClick(props.node.key, props.node, modify)
}

// 双击节点。
function handleDoubleClick(event: MouseEvent) {
  event.stopPropagation()
  nodeTree.handleNodeDoubleClick(props.node)
}

// 转发节点 action。
function handleActionTrigger(payload: { actionKey: string; caller: ActionCaller; node?: ITreeNode }) {
  nodeTree.callAction(payload.actionKey, payload.caller, payload.node)
}

// 节点按下事件（拖拽起点）。
function handleMouseDown(event: MouseEvent) {
  event.stopPropagation()
  nodeTree.handleNodePointerDown(props.node, event)
}

// 重命名输入实时更新。
function handleRenameInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) {
    return
  }
  nodeTree.updateRenameDraft(target.value)
}

// 重命名键盘提交/取消。
function handleRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault()
    nodeTree.submitNodeRename(props.node)
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    nodeTree.cancelNodeRename()
  }
}

// 重命名失焦取消。
function handleRenameBlur() {
  nodeTree.cancelNodeRename()
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
