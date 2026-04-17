/**
 * 模块说明：
 * - 管理卡牌结构树 选择 重命名 增删块与拖拽重排
 * 职责边界：
 * - 只处理文档结构编辑与选择同步 不处理文件系统规则
 */
import { computed, type Ref } from 'vue'
import {
  addBlockToContainer,
  blockToTreeNode,
  createBlock,
  moveBlockBetweenContainers,
  removeBlockFromContainer,
  type BlockContainer,
  type CardBlock,
  type CardDocument,
  type CardTreeNodeMetadata,
  type FlowContainerLocationInfo,
  type ParentLookup,
  type SimpleContainerLocationInfo,
  isBlockContainer,
  isCardBlock,
} from '../entities/card/model'
import type {
  ITreeNode,
  NodeTreeActionCalledPayload,
  NodeTreeCanDropPayload,
  NodeTreeDropPayload,
  NodeTreeRenamePayload,
} from '../shared/ui/tree/tree.types'

const ENABLE_CDE_TREE_DND_DEBUG = import.meta.env.DEV && Boolean(
  (globalThis as { __OC_DEBUG_CDE_TREE_DND__?: unknown }).__OC_DEBUG_CDE_TREE_DND__,
)

type UseCdeTreeOpsOptions = {
  cardDoc: Ref<CardDocument | null>
  parentLookup: Ref<ParentLookup>
  selectedBlockKeys: Ref<string[]>
  markDocumentChanged: () => void
}

function logTreeDndDebug(message: string, payloadFactory: () => Record<string, unknown>) {
  if (!ENABLE_CDE_TREE_DND_DEBUG) {
    return
  }

  console.debug(message, payloadFactory())
}

export function useCdeTreeOps(options: UseCdeTreeOpsOptions) {
  const blockTree = computed<ITreeNode[]>(() => {
    if (!options.cardDoc.value) {
      return []
    }

    return options.cardDoc.value.children.map((child) =>
      blockToTreeNode(child.block, null, child.location),
    )
  })

  const selectedNode = computed<ITreeNode | null>(() => {
    const selectedKey = options.selectedBlockKeys.value[0]
    if (!selectedKey) {
      return null
    }

    return findTreeNodeByKey(blockTree.value, selectedKey)
  })

  const selectedBlock = computed<CardBlock | null>(() => {
    const metadata = selectedNode.value?.metadata as CardTreeNodeMetadata | undefined
    return metadata?.block ?? null
  })

  function onTreeSelect(nextSelectedKeys: string[]) {
    options.selectedBlockKeys.value = nextSelectedKeys
  }

  function handleViewportBlockClick(blockId: string) {
    const clickedNode = findTreeNodeByBlockId(blockTree.value, blockId)
    if (!clickedNode) {
      options.selectedBlockKeys.value = []
      return
    }

    options.selectedBlockKeys.value = [clickedNode.key]
  }

  function clearSelection() {
    options.selectedBlockKeys.value = []
  }

  function handleTreeAction({ actionKey, caller, node }: NodeTreeActionCalledPayload) {
    if (caller === 'node' && node) {
      options.selectedBlockKeys.value = [node.key]
    }

    const callerObject = caller === 'node' ? getNodeBlock(node) : options.cardDoc.value
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

  function handleTreeRename({ node, name }: NodeTreeRenamePayload) {
    const block = getNodeBlock(node)
    if (!block) {
      return
    }

    const nextName = name.trim()
    if (!nextName || block.name === nextName) {
      return
    }

    block.name = nextName
    options.markDocumentChanged()
  }

  function canDropTreeNode({ dragged, target, position }: NodeTreeCanDropPayload) {
    if (target && dragged.key === target.key) {
      logTreeDndDebug('[blocktree] canDrop=false same-node', () => ({
        dragged: dragged.key,
        target: target.key,
        position,
      }))
      return false
    }

    if (target && isDescendantOrSelfNode(target, dragged)) {
      logTreeDndDebug('[blocktree] canDrop=false descendant', () => ({
        dragged: dragged.key,
        target: target.key,
        position,
      }))
      return false
    }

    const draggedBlock = getNodeBlock(dragged)
    if (!draggedBlock) {
      return false
    }

    const sourceContainer = options.parentLookup.value.get(draggedBlock.id)
    const targetContainer = getContainerForDropTarget(target, position)
    const insertionIndex = getInsertionIndexForDropTarget(target, position)

    if (!sourceContainer || !targetContainer || insertionIndex === null) {
      logTreeDndDebug('[blocktree] canDrop=false missing-target', () => ({
        dragged: dragged.key,
        target: target?.key ?? null,
        position,
        sourceContainer: sourceContainer?.type ?? null,
        targetContainer: targetContainer?.type ?? null,
        insertionIndex,
      }))
      return false
    }

    logTreeDndDebug('[blocktree] canDrop=true', () => ({
      dragged: dragged.key,
      target: target?.key ?? null,
      position,
      sourceContainer: sourceContainer.type,
      targetContainer: targetContainer.type,
      insertionIndex,
    }))
    return true
  }

  function handleTreeDrop({ dragged, target, position }: NodeTreeDropPayload) {
    const draggedBlock = getNodeBlock(dragged)
    if (!draggedBlock || !canDropTreeNode({ dragged, target, position })) {
      return
    }

    const sourceContainer = options.parentLookup.value.get(draggedBlock.id)
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
      options.parentLookup.value,
      location,
      insertionIndex,
    )

    if (!movedBlock) {
      return
    }

    const updatedNode = findTreeNodeByBlockId(blockTree.value, draggedBlock.id)
    options.selectedBlockKeys.value = updatedNode ? [updatedNode.key] : []
    options.markDocumentChanged()
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

    addBlockToContainer(container, newBlock, options.parentLookup.value)
    options.markDocumentChanged()
  }

  function deleteBlock(block: CardBlock) {
    const container = options.parentLookup.value.get(block.id)
    if (!container) {
      return
    }

    const removedBlock = removeBlockFromContainer(container, block.id, options.parentLookup.value)
    if (!removedBlock) {
      return
    }

    options.selectedBlockKeys.value = options.selectedBlockKeys.value.filter((key) => key !== block.id)
    options.markDocumentChanged()
  }

  function getNodeBlock(node?: ITreeNode): CardBlock | null {
    const metadata = node?.metadata as CardTreeNodeMetadata | undefined
    return metadata?.block ?? null
  }

  function findTreeNodeByKey(nodes: ITreeNode[], key: string): ITreeNode | null {
    for (const node of nodes) {
      if (node.key === key) {
        return node
      }

      const childNode = findTreeNodeByKey(node.children ?? [], key)
      if (childNode) {
        return childNode
      }
    }

    return null
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
      return options.cardDoc.value
    }

    const targetBlock = getNodeBlock(targetNode)
    if (!targetBlock) {
      return null
    }

    if (position === 'inside') {
      return isBlockContainer(targetBlock) ? targetBlock : null
    }

    return options.parentLookup.value.get(targetBlock.id) ?? null
  }

  function getInsertionIndexForDropTarget(targetNode: ITreeNode | null, position: NodeTreeCanDropPayload['position']): number | null {
    if (!targetNode) {
      return options.cardDoc.value?.children.length ?? null
    }

    const targetBlock = getNodeBlock(targetNode)
    if (!targetBlock) {
      return null
    }

    if (position === 'inside') {
      const targetContainer = getContainerForDropTarget(targetNode, position)
      return targetContainer ? targetContainer.children.length : null
    }

    const targetContainer = options.parentLookup.value.get(targetBlock.id)
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

  return {
    blockTree,
    selectedNode,
    selectedBlock,
    onTreeSelect,
    handleViewportBlockClick,
    clearSelection,
    handleTreeAction,
    handleTreeRename,
    canDropTreeNode,
    handleTreeDrop,
  }
}
