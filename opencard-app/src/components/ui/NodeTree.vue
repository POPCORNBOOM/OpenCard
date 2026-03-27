<template>
    <div class="node-tree">
        <div class="root-content" @click="handleClick">
            <i class="codicon" :class="isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'"></i>
            <span class="root-title">{{ props.title }}</span>
            <div v-if="treeActions.length" class="root-actions">
                <i
                    v-for="action in treeActions"
                    :key="action.key"
                    class="codicon action-btn"
                    :class="action.icon"
                    :title="action.title"
                    @click.stop="callAction(action.key, 'tree')"
                />
            </div>
        </div>

        <div v-if="isExpanded">
            <TreeNode v-for="node in nodes" :key="node.key" :node="node" :level="1" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, provide, ref, type ComputedRef } from 'vue'
import TreeNode, { type ITreeNode } from './TreeNode.vue'

export interface ActionDefinition {
    key: string
    icon: string
    title?: string
}

export interface NodeTreeActionCalledPayload {
    actionKey: string
    caller: 'tree' | 'node'
    node?: ITreeNode
}

export interface NodeTreeTogglePayload {
    node: ITreeNode
    expanded: boolean
}

interface Props {
    nodes: ITreeNode[]
    multiSelect?: boolean
    selected?: Map<string, ITreeNode>
    title?: string
    expanded?: boolean
    defaultExpanded?: boolean
    actions?: Map<string, ActionDefinition>
    actionKeys?: string[]
}

const props = withDefaults(defineProps<Props>(), {
    multiSelect: true,
    selected: () => new Map<string, ITreeNode>(),
    defaultExpanded: false,
    actions: () => new Map<string, ActionDefinition>(),
    actionKeys: () => [],
})

const emit = defineEmits<{
    'update:selected': [value: Map<string, ITreeNode>]
    'update:expanded': [value: boolean]
    'node-dblclick': [node: ITreeNode]
    'node-toggle': [payload: NodeTreeTogglePayload]
    'action-called': [payload: NodeTreeActionCalledPayload]
}>()

const isExpanded = ref(props.expanded ?? props.defaultExpanded)

const selectedNodes = computed(() => props.selected || new Map<string, ITreeNode>())
const treeActions = computed(() => {
    return props.actionKeys
        .map((key) => props.actions.get(key))
        .filter((action): action is ActionDefinition => action !== undefined)
})

function handleNodeDoubleClick(node: ITreeNode) {
    emit('node-dblclick', node)
}

function handleNodeClick(key: string, node: ITreeNode, modify: 'ctrl' | 'none') {
    const newSelected = new Map(props.selected || new Map<string, ITreeNode>())

    if (modify === 'ctrl') {
        if (newSelected.has(key)) {
            newSelected.delete(key)
        } else {
            newSelected.set(key, node)
        }
    } else {
        newSelected.clear()
        newSelected.set(key, node)
    }

    emit('update:selected', newSelected)
}

function callAction(actionKey: string, caller: 'tree' | 'node', node?: ITreeNode) {
    emit('action-called', { actionKey, caller, node })
}

function handleNodeToggle(node: ITreeNode, expanded: boolean) {
    emit('node-toggle', { node, expanded })
}

provide('nodeTree', {
    selectedNodes,
    handleNodeClick,
    handleNodeDoubleClick,
    handleNodeToggle,
    callAction,
    actions: computed(() => props.actions) as ComputedRef<Map<string, ActionDefinition>>,
    multiSelect: props.multiSelect,
})

function handleClick() {
    const nextExpanded = !isExpanded.value
    isExpanded.value = nextExpanded

    emit('update:expanded', nextExpanded)
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
