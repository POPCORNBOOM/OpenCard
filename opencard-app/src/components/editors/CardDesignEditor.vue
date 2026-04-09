<template>
  <div class="card-design-editor">
    <div class="canvas-area">
      <CardViewport v-if="cardDoc" :document="cardDoc" :selected-block-id="selectedBlock?.id ?? null"
        :selected-location-type="selectedLocationType" :selected-anchor="selectedAnchor"
        :selected-parent-block-id="selectedParentBlockId" :transform-disabled-block-ids="transformDisabledBlockIds"
        @block-click="handleViewportBlockClick" @blank-click="clearSelection"
        @resize-selection="handleSelectionResize" @move-selection="handleSelectionMove" />
      <div v-else class="empty-hint">无法解析 .opencard 文件</div>
    </div>

    <div class="right-panel">
      <div class="block-list-panel">
        <div class="panel-header">信息树</div>
        <div class="block-list">
          <NodeTree title="模板结构" :nodes="blockTree" :selected="selectedBlocks" :actions="treeActions"
            :expanded="blockTreeExpanded" :action-keys="treeActionKeys" :can-drop="canDropTreeNode"
            @update:selected="onTreeSelect" @action-called="handleTreeAction" @node-drop="handleTreeDrop" />
          <NodeTree title="创建的卡牌" :nodes="[]" />
        </div>
      </div>

      <div class="property-panel">
        <div class="panel-header">属性</div>
        <div class="panel-header-actions">
          <button class="panel-icon-button" :class="{ active: propertySortMode === 'category' }" type="button"
            title="Category" @click="propertySortMode = 'category'">
            <span class="codicon codicon-list-tree" />
          </button>
          <button class="panel-icon-button" :class="{ active: propertySortMode === 'alphabetical' }" type="button"
            title="A-Z" @click="propertySortMode = 'alphabetical'">
            <span class="codicon codicon-symbol-string" />
          </button>
        </div>
        <PropertyEditor :sources="propertySources" :sort-mode="propertySortMode" @update-property="updateBlockProp" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { EditorEmits, EditorProps } from '../../core/Editor'
import {
  addBlockToContainer,
  buildParentLookup,
  blockToTreeNode,
  BlockContainer,
  createBlock,
  type ParentLookup,
  removeBlockFromContainer,
  type CardBlock,
  type CardDocument,
  type CardTreeNodeMetadata,
  type PropertyEditorSource,
  isBlockContainer,
  isCardBlock,
  getBlockTreeIcon,
  moveBlockBetweenContainers,
  type FlowContainerLocationInfo,
  type SimpleContainerLocationInfo,
} from '../../core/Card'
import CardViewport from '../card/CardViewport.vue'
import NodeTree, {
  type ActionDefinition,
  type NodeTreeActionCalledPayload,
  type NodeTreeCanDropPayload,
  type NodeTreeDropPayload,
} from '../ui/NodeTree.vue'
import type { ITreeNode } from '../ui/TreeNode.vue'
import PropertyEditor from './PropertyEditor.vue'

type PropertySortMode = 'category' | 'alphabetical'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()

const blockTreeExpanded = ref(true)
const rawContent = ref('')
const cardDoc = ref<CardDocument | null>(null)
const parentLookup = ref<ParentLookup>(new Map())
const isModified = ref(false)
const propertySortMode = ref<PropertySortMode>('category')
const treeActions = new Map<string, ActionDefinition>([
  ['add-root', {
    key: 'add-root',
    icon: 'codicon-add',
    title: '添加',
    children: [
      { key: 'add-text-block', icon: getBlockTreeIcon('text-block'), title: '文本块' },
      { key: 'add-image-block', icon: getBlockTreeIcon('image-block'), title: '图片块' },
      { key: 'add-simple-container-block', icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' },
      { key: 'add-flow-container-block', icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' },
    ],
  }],
  ['delete-selected', { key: 'delete-selected', icon: 'codicon-trash', title: '删除选中' }],
  ['add', {
    key: 'add',
    icon: 'codicon-add',
    title: '添加',
    children: [
      { key: 'add-text-block', icon: getBlockTreeIcon('text-block'), title: '文本块' },
      { key: 'add-image-block', icon: getBlockTreeIcon('image-block'), title: '图片块' },
      { key: 'add-simple-container-block', icon: getBlockTreeIcon('simple-container-block'), title: '简单容器' },
      { key: 'add-flow-container-block', icon: getBlockTreeIcon('flow-container-block'), title: '流式容器' },
    ],
  }],
  ['delete', { key: 'delete', icon: 'codicon-trash', title: '删除' }],
])
const treeActionKeys = ['add-root', 'delete-selected']

const selectedBlocks = ref<Map<string, ITreeNode>>(new Map())
const selectedNode = computed<ITreeNode | null>(() => {
  if (selectedBlocks.value.size === 0) return null
  return selectedBlocks.value.values().next().value ?? null
})

const selectedBlock = computed<CardBlock | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.block ?? null
})

const selectedLayout = computed<Record<string, unknown> | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location ? (metadata.location as Record<string, unknown>) : null
})

const selectedLocationType = computed<'simple-container-location' | 'flow-container-location' | null>(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location?.type ?? null
})
const selectedAnchor = computed(() => {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.location?.type === 'simple-container-location' ? metadata.location.anchor : null
})
const selectedParentBlockId = computed(() => {
  const block = selectedBlock.value
  if (!block) {
    return null
  }

  const parent = parentLookup.value.get(block.id)
  return parent && parent.type !== 'card-document' ? parent.id : null
})
const transformDisabledBlockIds = computed(() => {
  const block = selectedBlock.value
  if (!block) {
    return []
  }

  const ids: string[] = []
  let current: CardBlock | null = block
  while (current) {
    ids.push(current.id)
    const parent = parentLookup.value.get(current.id)
    if (!parent || parent.type === 'card-document') {
      break
    }
    current = parent
  }
  return ids
})

const propertySources = computed<PropertyEditorSource[]>(() => {
  const sources: PropertyEditorSource[] = []

  if (selectedBlock.value) {
    sources.push({
      title: 'Block',
      target: selectedBlock.value as Record<string, unknown> & { type?: string },
    })
  }

  if (selectedLayout.value) {
    sources.push({
      title: 'Layout',
      target: selectedLayout.value as Record<string, unknown> & { type?: string },
    })
  }

  return sources
})

const blockTree = computed(() => {
  if (!cardDoc.value) return []
  return cardDoc.value.children.map((child) =>
    blockToTreeNode(child.block, null, child.location)
  )
})

function syncDocumentContent() {
  if (!cardDoc.value) {
    return
  }

  const content = JSON.stringify(cardDoc.value, null, 2)
  if (content === rawContent.value) {
    return
  }

  rawContent.value = content
  emit('update:modelValue', content)
}

function markDocumentChanged() {
  isModified.value = true
  emit('modified', true)
  syncDocumentContent()
}

function updateBlockProp({
  target,
  key,
  value,
}: {
  target: Record<string, unknown>
  key: string
  value: unknown
}) {
  target[key] = value

  if (target.type === 'image-block' && key === 'image') {
    delete target.assetId
    delete target.imagePath
  }

  markDocumentChanged()
}

function normalizeImageBlockFields(block: CardBlock) {
  if (block.type === 'image-block') {
    if (!block.image) {
      block.image = block.imagePath ?? block.assetId ?? ''
    }
    return
  }

  if (block.type === 'simple-container-block' || block.type === 'flow-container-block') {
    for (const child of block.children) {
      normalizeImageBlockFields(child.block)
    }
  }
}

function onTreeSelect(newSelected: Map<string, ITreeNode>) {
  selectedBlocks.value = newSelected
}

function handleViewportBlockClick(blockId: string) {
  const clickedNode = findTreeNodeByBlockId(blockTree.value, blockId)
  if (!clickedNode) {
    return
  }

  selectedBlocks.value = new Map([[clickedNode.key, clickedNode]])
}

function clearSelection() {
  if (selectedBlocks.value.size === 0) {
    return
  }

  selectedBlocks.value = new Map()
}

function handleSelectionResize(payload: { width: number; height: number; x?: number; y?: number }) {
  const block = selectedBlock.value
  if (!block) {
    return
  }

  block.width = Math.round(payload.width * 100) / 100
  block.height = Math.round(payload.height * 100) / 100

  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  if (metadata?.location?.type === 'simple-container-location') {
    metadata.location.x = Math.round((payload.x ?? 0) * 100) / 100
    metadata.location.y = Math.round((payload.y ?? 0) * 100) / 100
  }

  markDocumentChanged()
}

function handleSelectionMove(payload: { x: number; y: number }) {
  const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
  if (metadata?.location?.type !== 'simple-container-location') {
    return
  }

  metadata.location.x = Math.round(payload.x * 100) / 100
  metadata.location.y = Math.round(payload.y * 100) / 100
  markDocumentChanged()
}

function handleTreeAction({ actionKey, caller, node }: NodeTreeActionCalledPayload) {
  if (caller === 'node' && node) {
    selectedBlocks.value = new Map([[node.key, node]])
  }

  const callerObject = caller === 'node' ? getNodeBlock(node) : cardDoc.value
  if (!callerObject) {
    return
  }

  switch (actionKey) {
    case 'add-text-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'text-block')
      return
    case 'add-image-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'image-block')
      return
    case 'add-simple-container-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'simple-container-block')
      return
    case 'add-flow-container-block':
      if (isBlockContainer(callerObject)) createBlockAt(callerObject, 'flow-container-block')
      return
    case 'delete':
      if (isCardBlock(callerObject)) deleteBlock(callerObject)
      return
    case 'delete-selected':
      if (isCardBlock(selectedBlock.value)) deleteBlock(selectedBlock.value)
      return
  }
}

function getNodeBlock(node?: ITreeNode): CardBlock | null {
  const metadata = node?.metadata as CardTreeNodeMetadata | undefined
  return metadata?.block ?? null
}

function findTreeNodeByBlockId(nodes: ITreeNode[], blockId: string): ITreeNode | null {
  for (const node of nodes) {
    const block = getNodeBlock(node)
    if (block?.id === blockId) {
      return node
    }

    const childNode = findTreeNodeByBlockId(node.children ?? [], blockId)
    if (childNode) {
      return childNode
    }
  }

  return null
}

function isDescendantOrSelfNode(targetNode: ITreeNode, ancestorNode: ITreeNode) {
  return targetNode.path?.includes(ancestorNode.key) ?? false
}

function getContainerForDropTarget(targetNode: ITreeNode | null, position: NodeTreeCanDropPayload['position']): BlockContainer | null {
  if (!targetNode) {
    return cardDoc.value
  }

  const targetBlock = getNodeBlock(targetNode)
  if (!targetBlock) {
    return null
  }

  if (position === 'inside') {
    return isBlockContainer(targetBlock) ? targetBlock : null
  }

  return parentLookup.value.get(targetBlock.id) ?? null
}

function getInsertionIndexForDropTarget(targetNode: ITreeNode | null, position: NodeTreeCanDropPayload['position']): number | null {
  if (!targetNode) {
    return cardDoc.value?.children.length ?? null
  }

  const targetBlock = getNodeBlock(targetNode)
  if (!targetBlock) {
    return null
  }

  if (position === 'inside') {
    const targetContainer = getContainerForDropTarget(targetNode, position)
    return targetContainer ? targetContainer.children.length : null
  }

  const targetContainer = parentLookup.value.get(targetBlock.id)
  if (!targetContainer) {
    return null
  }

  const targetIndex = targetContainer.children.findIndex((child) => child.block.id === targetBlock.id)
  if (targetIndex === -1) {
    return null
  }

  return position === 'before' ? targetIndex : targetIndex + 1
}

function createDropLocation(
  draggedNode: ITreeNode,
  targetContainer: BlockContainer,
  insertionIndex: number,
): SimpleContainerLocationInfo | FlowContainerLocationInfo {
  const metadata = draggedNode.metadata as CardTreeNodeMetadata | undefined
  const currentLocation = metadata?.location

  if (targetContainer.type === 'flow-container-block') {
    const align = currentLocation?.type === 'flow-container-location' ? currentLocation.align : undefined
    return {
      type: 'flow-container-location',
      index: insertionIndex,
      align,
    }
  }

  if (currentLocation?.type === 'simple-container-location') {
    return { ...currentLocation }
  }

  return {
    type: 'simple-container-location',
    anchor: 'lt',
    x: 0,
    y: 0,
  }
}

function canDropTreeNode({ dragged, target, position }: NodeTreeCanDropPayload) {
  if (target && dragged.key === target.key) {
    console.debug('[blocktree] canDrop=false same-node', { dragged: dragged.key, target: target.key, position })
    return false
  }

  if (target && isDescendantOrSelfNode(target, dragged)) {
    console.debug('[blocktree] canDrop=false descendant', { dragged: dragged.key, target: target.key, position })
    return false
  }

  const draggedBlock = getNodeBlock(dragged)
  if (!draggedBlock) {
    return false
  }

  const sourceContainer = parentLookup.value.get(draggedBlock.id)
  const targetContainer = getContainerForDropTarget(target, position)
  const insertionIndex = getInsertionIndexForDropTarget(target, position)

  if (!sourceContainer || !targetContainer || insertionIndex === null) {
    console.debug('[blocktree] canDrop=false missing-target', {
      dragged: dragged.key,
      target: target?.key ?? null,
      position,
      sourceContainer: sourceContainer?.type ?? null,
      targetContainer: targetContainer?.type ?? null,
      insertionIndex,
    })
    return false
  }

  console.debug('[blocktree] canDrop=true', {
    dragged: dragged.key,
    target: target?.key ?? null,
    position,
    sourceContainer: sourceContainer.type,
    targetContainer: targetContainer.type,
    insertionIndex,
  })
  return true
}

function handleTreeDrop({ dragged, target, position }: NodeTreeDropPayload) {
  const draggedBlock = getNodeBlock(dragged)
  if (!draggedBlock || !canDropTreeNode({ dragged, target, position })) {
    return
  }

  const sourceContainer = parentLookup.value.get(draggedBlock.id)
  const targetContainer = getContainerForDropTarget(target, position)
  let insertionIndex = getInsertionIndexForDropTarget(target, position)

  if (!sourceContainer || !targetContainer || insertionIndex === null) {
    return
  }

  if (sourceContainer === targetContainer) {
    const sourceIndex = sourceContainer.children.findIndex((child) => child.block.id === draggedBlock.id)
    if (sourceIndex !== -1 && sourceIndex < insertionIndex) {
      insertionIndex -= 1
    }
  }

  const location = createDropLocation(dragged, targetContainer, insertionIndex)
  const movedBlock = moveBlockBetweenContainers(
    sourceContainer,
    targetContainer,
    draggedBlock.id,
    parentLookup.value,
    location,
    insertionIndex,
  )

  if (!movedBlock) {
    return
  }

  const updatedNode = findTreeNodeByBlockId(blockTree.value, draggedBlock.id)
  selectedBlocks.value = updatedNode ? new Map([[updatedNode.key, updatedNode]]) : new Map()
  markDocumentChanged()
}

function applyDocumentContent(content: string) {
  rawContent.value = content
  selectedBlocks.value = new Map()

  try {
    const parsed = JSON.parse(content) as CardDocument
    for (const child of parsed.children) {
      normalizeImageBlockFields(child.block)
    }
    cardDoc.value = parsed
    parentLookup.value = buildParentLookup(parsed)
    isModified.value = false
    emit('modified', false)
  } catch (e) {
    console.error('读取 .opencard 文件失败:', e)
    cardDoc.value = null
    parentLookup.value = new Map()
    isModified.value = false
    emit('modified', false)
  }
}

function createBlockAt(container: BlockContainer, type: CardBlock['type']) {
  let newBlock: CardBlock

  switch (type) {
    case 'text-block':
      newBlock = createBlock('text-block')
      break
    case 'image-block':
      newBlock = createBlock('image-block')
      break
    case 'simple-container-block':
      newBlock = createBlock('simple-container-block')
      break
    case 'flow-container-block':
      newBlock = createBlock('flow-container-block')
      break
  }

  addBlockToContainer(container, newBlock, parentLookup.value)
  markDocumentChanged()
}

function deleteBlock(block: CardBlock) {
  const container = parentLookup.value.get(block.id)
  if (!container) {
    return
  }

  const removedBlock = removeBlockFromContainer(container, block.id, parentLookup.value)
  if (!removedBlock) {
    return
  }

  selectedBlocks.value.delete(block.id)
  selectedBlocks.value = new Map(selectedBlocks.value)
  markDocumentChanged()
}

async function saveFile() {
  if (!cardDoc.value) return
  try {
    const content = JSON.stringify(cardDoc.value, null, 2)
    rawContent.value = content
    isModified.value = false
    emit('update:modelValue', content)
    emit('modified', false)
    emit('save')
  } catch (e) {
    console.error('保存失败:', e)
  }
}

watch(
  () => props.modelValue,
  (nextValue) => {
    const content = nextValue ?? ''
    if (!content || content === rawContent.value) {
      return
    }

    applyDocumentContent(content)
  },
  { immediate: true },
)

defineExpose({ save: saveFile })

</script>

<style scoped>
.card-design-editor {
  display: flex;
  height: 100%;
  background: #1e1e1e;
  color: #ccc;
}

.canvas-area {
  flex: 1;
  display: flex;
  position: relative;
  background: #2d2d2d;
}

.right-panel {
  width: 280px;
  border-left: 1px solid #000;
  display: flex;
  flex-direction: column;
}

.block-list-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #000;
  overflow: hidden;
}

.property-panel {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  height: 30px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  text-transform: uppercase;
  font-weight: bold;
  background: #252526;
  border-bottom: 1px solid #000;
}

.panel-header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  position: absolute;
  top: 5px;
  right: 10px;
  z-index: 1;
}

.panel-icon-button {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  background: transparent;
  color: #8f8f8f;
  cursor: pointer;
  padding: 0;
}

.panel-icon-button:hover {
  color: #d4d4d4;
  border-color: #3f3f46;
  background: #2a2d2e;
}

.panel-icon-button.active {
  color: #ffffff;
  border-color: #0e639c;
  background: #094771;
}

.block-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.block-item {
  padding: 4px 10px;
  cursor: pointer;
  display: flex;
  gap: 8px;
  font-size: 12px;
}

.block-item:hover {
  background: #2a2d2e;
}

.block-item.selected {
  background: #094771;
}

.block-type {
  color: #569cd6;
}

.block-id {
  color: #888;
}

.empty-hint {
  color: #666;
  font-size: 12px;
  text-align: center;
  padding: 20px;
}
</style>
