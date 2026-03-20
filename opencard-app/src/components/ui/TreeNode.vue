<template>
  <div class="tree-node">
    <div class="node-content" :class="{ selected: isSelected }" :style="{ paddingLeft: `${level * 12}px` }"
      @click="handleClick" @dblclick="handleDoubleClick">
      <i v-if="node.isExpandable" class="codicon"
        :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
      <i v-if="!node.isExpandable" class="codicon" :class="node.icon || 'codicon-file'"></i>
      <span class="node-name">{{ node.name }}</span>
    </div>

    <div v-if="node.isExpandable && isExpanded">
      <TreeNode v-for="child in node.children" :key="child.path" :node="child" :level="level + 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, type ComputedRef } from 'vue'

const nodeTree = inject<{
  selectedNodes: ComputedRef<Set<string>>
  handleNodeClick: (path: string, modify: 'ctrl' | 'none') => void
  handleNodeDoubleClick: (node: ITreeNode) => void
  multiSelect: boolean
}>('nodeTree')

export interface ITreeNode {
  name: string
  path: string
  isExpandable: boolean
  icon?: string
  children?: ITreeNode[]
  metadata?: Record<string, any>
}

const props = defineProps<{
  node: ITreeNode
  level: number
}>()

const isSelected = computed(() => {
  return nodeTree?.selectedNodes.value.has(props.node.path) || false
})
const isExpanded = ref(false)

function handleClick(event: MouseEvent) {
  event.stopPropagation()


  const modify = (event.metaKey || event.ctrlKey) ? 'ctrl' : 'none'

  if (modify === 'none') {
    if (props.node.isExpandable) {
      isExpanded.value = !isExpanded.value
    }
  }
  nodeTree?.handleNodeClick(props.node.path, modify)

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
</style>
