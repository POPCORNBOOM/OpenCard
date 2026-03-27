<template>
  <div class="tree-node">
    <div class="node-content" :class="{ selected: isSelected }" :style="{ paddingLeft: `${level * 12}px` }"
      @click="handleClick" @dblclick="handleDoubleClick">
      <i v-if="isExpandable" class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"
        @click="() => nodeTree?.handleNodeToggle(props.node, !isExpanded)" />
      <i v-else class="codicon" :class="node.icon || 'codicon-file'" />
      <span class="node-name">{{ node.name }}</span>
      <div v-if="availableActions.length" class="node-actions">
        <i v-for="action in availableActions" :key="action.key" class="codicon action-btn" :class="action.icon"
          :title="action.title" @click.stop="() => nodeTree?.callAction(action.key, 'node', props.node)" />
      </div>
    </div>

    <div v-if="isExpandable && isExpanded">
      <TreeNode v-for="child in node.children" :key="child.key" :node="child" :level="level + 1" />
    </div>
  </div>
</template>

<script lang="ts">
export interface ITreeNode {
  name: string
  key: string
  path?: string[]
  isExpandable?: boolean
  isExpanded?: boolean
  icon?: string
  parent?: ITreeNode | null
  children?: ITreeNode[]
  metadata?: Record<string, any>
  actionKeys?: string[]
}
</script>

<script setup lang="ts">
import { computed, inject, ref, watch, type ComputedRef } from 'vue'
import type { ActionDefinition } from './NodeTree.vue'

const props = defineProps<{
  node: ITreeNode
  level: number
}>()

const nodeTree = inject<{
  selectedNodes: ComputedRef<Map<string, ITreeNode>>
  handleNodeClick: (key: string, node: ITreeNode, modify: 'ctrl' | 'none') => void
  handleNodeDoubleClick: (node: ITreeNode) => void
  handleNodeToggle: (node: ITreeNode, expanded: boolean) => void
  callAction: (actionKey: string, caller: 'tree' | 'node', node?: ITreeNode) => void
  actions: ComputedRef<Map<string, ActionDefinition>>
  multiSelect: boolean
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

const isExpandable = computed(() => {
  if (props.node.isExpandable === true) return true
  if (props.node.isExpandable === false) return false
  return Boolean(props.node.children?.length)
})

const uncontrolledExpanded = ref(props.node.isExpanded ?? false)
const isExpandedControlled = computed(() => props.node.isExpanded !== undefined)
const isExpanded = computed(() => {
  return isExpandedControlled.value ? props.node.isExpanded ?? false : uncontrolledExpanded.value
})

watch(
  () => props.node.isExpanded,
  (nextExpanded) => {
    if (nextExpanded === undefined) {
      return
    }

    uncontrolledExpanded.value = nextExpanded
  },
)

function handleClick(event: MouseEvent) {
  event.stopPropagation()

  const modify = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'

  if (modify === 'none' && isExpandable.value) {
    if (!isExpandedControlled.value) {
      uncontrolledExpanded.value = !isExpanded.value
    }
  }

  nodeTree?.handleNodeClick(props.node.key, props.node, modify)
}

function handleDoubleClick(event: MouseEvent) {
  event.stopPropagation()
  nodeTree?.handleNodeDoubleClick(props.node)
}
</script>

<style scoped>
.tree-node {
  user-select: none;
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
  background: #2a2d2e;
}

.node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-content.selected {
  background: #04395e;
}

.node-content.focused {
  background: #094771;
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

.action-btn {
  padding: 2px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.action-btn:hover {
  background: #454545;
}
</style>
