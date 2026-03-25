<template>
    <div class="node-tree">
        <div class="root-content" @click="handleClick">
            <i class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
            <span class="root-title">{{ props.title }}</span>
            <div v-if="props.actions?.length" class="root-actions">
                <i v-for="(action, i) in props.actions" :key="i" class="codicon action-btn" :class="action.icon"
                    :title="action.title" @click.stop="action.handler" />
            </div>
        </div>

        <div v-if="isExpanded">
            <TreeNode v-for="node in nodes" :key="node.key" :node="node" :level="1" />
        </div>
    </div>
</template>
<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import TreeNode, { ITreeNode } from './TreeNode.vue';

export interface ITreeAction {
    icon: string        // codicon class, e.g. 'codicon-add'
    title?: string      // tooltip
    handler: () => void
}

interface Props {
    nodes: ITreeNode[]
    multiSelect?: boolean
    selected?: Map<string, ITreeNode>
    title?: string
    actions?: ITreeAction[]
}

const props = withDefaults(defineProps<Props>(), {
    multiSelect: true,
    selected: () => new Map<string, ITreeNode>(),
})

function handleNodeDoubleClick(node: ITreeNode) {
    emit('node-dblclick', node)
}

function handleNodeClick(key: string, node: ITreeNode, modify: 'ctrl' | 'none') {
    const newSelected = new Map(props.selected || new Map<string, ITreeNode>())

    // modify: 'ctrl' | 'none'
    if (modify === 'ctrl') {
        if (newSelected.has(key)) {
            newSelected.delete(key)
        } else {
            newSelected.set(key, node)
        }
    }
    else {
        newSelected.clear()
        newSelected.set(key, node)
    }
    emit('update:selected', newSelected)
}

// 提供方法给子组件调用

provide('nodeTree', {
    selectedNodes: computed(() => props.selected || new Map<string, ITreeNode>()),
    handleNodeClick: handleNodeClick,
    handleNodeDoubleClick: handleNodeDoubleClick,
    multiSelect: props.multiSelect
})

const emit = defineEmits<{
    'update:selected': [value: Map<string, ITreeNode>],
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

.root-actions {
    display: flex;
    visibility: hidden;
    gap: 2px;
    margin-right: 4px;
}

.node-tree:hover .root-actions {
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