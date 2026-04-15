<template>
    <div ref="treeRootElement" class="node-tree" :class="{ 'drag-over-root': draggedNode && !dropTargetNode && dropPosition, 'drop-invalid': draggedNode && !dropTargetNode && dropPosition && !dropAllowed, dragging: draggedNode }">
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
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, provide, ref, watch, type ComputedRef } from 'vue'
import TreeActionButton from './TreeActionButton.vue'
import TreeNode, { type ITreeNode } from './TreeNode.vue'

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

interface Props {
    nodes: ITreeNode[]
    multiSelect?: boolean
    selected?: Map<string, ITreeNode>
    title?: string
    expanded?: boolean
    defaultExpanded?: boolean
    defaultNodeExpanded?: boolean
    actions?: Map<string, ActionDefinition>
    actionKeys?: string[]
    canDrop?: (payload: NodeTreeCanDropPayload) => boolean
    allowedDropPositions?: NodeTreeAllowedDropPositions
}

const props = withDefaults(defineProps<Props>(), {
    multiSelect: true,
    selected: () => new Map<string, ITreeNode>(),
    defaultExpanded: false,
    defaultNodeExpanded: false,
    actions: () => new Map<string, ActionDefinition>(),
    actionKeys: () => [],
    canDrop: undefined,
    allowedDropPositions: undefined,
})

const emit = defineEmits<{
    'update:selected': [value: Map<string, ITreeNode>]
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

const isExpanded = ref(props.expanded ?? props.defaultExpanded)
const treeRootElement = ref<HTMLDivElement | null>(null)
const pendingDrag = ref<{ node: ITreeNode; startX: number; startY: number } | null>(null)
const draggedNode = ref<ITreeNode | null>(null)
const dropTargetNode = ref<ITreeNode | null>(null)
const dropPosition = ref<NodeTreeDropPosition | null>(null)
const dropAllowed = ref(false)
const suppressClick = ref(false)
const renamingNodeKey = ref<string | null>(null)
const renameDraft = ref('')
const instance = getCurrentInstance()
const vnodeProps = (instance?.vnode.props ?? {}) as Record<string, unknown>
const renameEnabled = Boolean(vnodeProps.onNodeRename || vnodeProps.onNodeRenameOnce)

watch(
    () => props.expanded,
    (nextExpanded) => {
        if (nextExpanded === undefined) {
            return
        }

        isExpanded.value = nextExpanded
    },
)

const selectedNodes = computed(() => props.selected || new Map<string, ITreeNode>())
const treeActions = computed(() => {
    return props.actionKeys
        .map((key) => props.actions.get(key))
        .filter((action): action is ActionDefinition => action !== undefined)
})

watch(
    selectedNodes,
    (nextSelected) => {
        if (!renamingNodeKey.value) {
            return
        }

        if (nextSelected.size !== 1 || !nextSelected.has(renamingNodeKey.value)) {
            cancelNodeRename()
        }
    },
)

function findNodeByKey(key: string, nodes: ITreeNode[]): ITreeNode | null {
    for (const node of nodes) {
        if (node.key === key) {
            return node
        }

        const childNode = findNodeByKey(key, node.children ?? [])
        if (childNode) {
            return childNode
        }
    }

    return null
}

function handleNodeDoubleClick(node: ITreeNode) {
    emit('node-dblclick', node)
}

function handleNodeClick(key: string, node: ITreeNode, modify: 'ctrl' | 'none') {
    if (renamingNodeKey.value && renamingNodeKey.value !== key) {
        cancelNodeRename()
    }

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

function callAction(actionKey: string, caller: ActionCaller, node?: ITreeNode) {
    emit('action-called', { actionKey, caller, node })
}

function handleActionTrigger(payload: NodeTreeActionCalledPayload) {
    callAction(payload.actionKey, payload.caller, payload.node)
}

function handleNodeToggle(node: ITreeNode, expanded: boolean) {
    emit('node-toggle', { node, expanded })
}

function startNodeRename(node: ITreeNode) {
    if (!renameEnabled || node.renamable === false) {
        return
    }

    renamingNodeKey.value = node.key
    renameDraft.value = node.name
}

function updateRenameDraft(value: string) {
    renameDraft.value = value
}

function cancelNodeRename() {
    renamingNodeKey.value = null
    renameDraft.value = ''
}

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

function clearDragState() {
    pendingDrag.value = null
    clearDropState()
}

function clearDropState() {
    dropTargetNode.value = null
    dropPosition.value = null
    dropAllowed.value = false
}

function markSuppressClick() {
    suppressClick.value = true
    window.setTimeout(() => {
        suppressClick.value = false
    }, 0)
}

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

function getAllowedDropPositions(target: ITreeNode | null): NodeTreeDropPosition[] {
    if (props.allowedDropPositions) {
        return props.allowedDropPositions(target)
    }

    if (!target) {
        return ['inside']
    }

    return target.isExpandable ? ['before', 'inside', 'after'] : ['before', 'after']
}

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

    const canDrop = dragged.key !== target.key && (props.canDrop?.({
        dragged,
        target,
        position,
    }) ?? true)

    dropTargetNode.value = target
    dropPosition.value = position
    dropAllowed.value = canDrop

    emit('repositioning', {
        dragged,
        target,
        position,
        canDrop,
    })

    return canDrop
}

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
    const canDrop = props.canDrop?.({
        dragged,
        target: null,
        position,
    }) ?? true

    dropTargetNode.value = null
    dropPosition.value = position
    dropAllowed.value = canDrop

    emit('repositioning', {
        dragged,
        target: null,
        position,
        canDrop,
    })

    return canDrop
}

function handleNodeDragEnd() {
    const dragged = draggedNode.value
    clearDragState()
    draggedNode.value = null

    if (dragged) {
        emit('drag-end', dragged)
    }
}

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
        const hoveredNode = nodeKey ? findNodeByKey(nodeKey, props.nodes) : null
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

onMounted(() => {
    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
})

onBeforeUnmount(() => {
    window.removeEventListener('mousemove', handleGlobalMouseMove)
    window.removeEventListener('mouseup', handleGlobalMouseUp)
})

provide('nodeTree', {
    selectedNodes,
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
    handleNodePointerOver,
    handleNodeDragEnd,
    actions: computed(() => props.actions) as ComputedRef<Map<string, ActionDefinition>>,
    multiSelect: props.multiSelect,
    defaultNodeExpanded: props.defaultNodeExpanded,
    renameEnabled,
    renamingNodeKey,
    renameDraft,
    startNodeRename,
    updateRenameDraft,
    cancelNodeRename,
    submitNodeRename,
})

function handleClick() {
    cancelNodeRename()
    const nextExpanded = !isExpanded.value
    isExpanded.value = nextExpanded

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
</style>
