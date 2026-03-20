<template>
    <div class="node-tree">
        <div class="root-content" @click="handleClick">
            <i class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
            <span class="root-title">{{ props.title }}</span>
        </div>

        <div v-if="isExpanded">
            <TreeNode v-for="node in nodes" :key="node.path" :node="node" :level="1" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import TreeNode, { ITreeNode } from './TreeNode.vue';

interface Props {
    nodes: ITreeNode[]
    multiSelect?: boolean
    selected?: Set<string>
    title?: string
}

const props = withDefaults(defineProps<Props>(), {
    multiSelect: true,
    selected: () => new Set<string>(),
})

function handleNodeDoubleClick(node: ITreeNode) {
    emit('node-dblclick', node)
}

function handleNodeClick(path: string, modify: 'ctrl' | 'none') {
    const newSelected = new Set(props.selected || new Set<string>())

    // modify: 'ctrl' | 'none'
    if (modify === 'ctrl') {
        if (newSelected.has(path)) {
            newSelected.delete(path)
        } else {
            newSelected.add(path)
        }
    }
    else {
        newSelected.clear()
        newSelected.add(path)
    }
    emit('update:selected', newSelected)
}

// 提供方法给子组件调用

provide('nodeTree', {
    selectedNodes: computed(() => props.selected || new Set<string>()),
    handleNodeClick: handleNodeClick,
    handleNodeDoubleClick: handleNodeDoubleClick,
    multiSelect: props.multiSelect
})

const emit = defineEmits<{
    'update:selected': [value: Set<string>],
    'node-dblclick': [node: ITreeNode]
}>()

const isExpanded = ref(false)

function handleClick() {
    isExpanded.value = !isExpanded.value
}
</script>
<style scoped>
.node-tree {
    user-select: none;
}

.root-content {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 0px;
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
</style>