/**
 * 模块说明：
 * - 管理卡牌结构树 选择 重命名 增删块与拖拽重排
 * 职责边界：
 * - 只处理文档结构编辑与选择同步 不处理文件系统规则
 */
import { computed, toRaw, watch, type Ref } from 'vue'
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
import type { CdeDocumentChangeMode } from './useCdeDocumentState'
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
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
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

  // Normalize selection keys without forcing a fallback node:
  // - allow empty selection for viewport blank-click clear
  // - collapse multi-select payloads to a single key
  // - drop stale keys that no longer exist in tree
  watch(
    [blockTree, options.selectedBlockKeys],
    ([nodes, selectedKeys]) => {
      const currentKey = selectedKeys[0] ?? null
      const matchedNode = currentKey ? findTreeNodeByKey(nodes, currentKey) : null
      const normalizedSelectedKeys = matchedNode ? [matchedNode.key] : []

      if (
        currentKey === normalizedSelectedKeys[0]
        && selectedKeys.length === normalizedSelectedKeys.length
      ) {
        return
      }

      options.selectedBlockKeys.value = normalizedSelectedKeys
    },
    { immediate: true },
  )

  function onTreeSelect(nextSelectedKeys: string[]) {
    options.selectedBlockKeys.value = nextSelectedKeys.length > 0 ? [nextSelectedKeys[0]] : []
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
      case 'duplicate':
        if (isCardBlock(callerObject)) duplicateBlock(callerObject)
        return
      case 'delete':
        if (isCardBlock(callerObject)) deleteBlock(callerObject)
        return
      case 'duplicate-selected':
        if (isCardBlock(selectedBlock.value)) duplicateBlock(selectedBlock.value)
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
    options.markDocumentChanged('action')
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
    options.markDocumentChanged('action')
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
    options.markDocumentChanged('action')
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
    options.markDocumentChanged('action')
  }

  function duplicateBlock(block: CardBlock) {
    const container = options.parentLookup.value.get(block.id)
    if (!container) {
      return
    }

    const sourceIndex = container.children.findIndex((child) => child.block.id === block.id)
    if (sourceIndex === -1) {
      return
    }

    const sourceChild = container.children[sourceIndex]
    const duplicatedBlock = cloneBlockWithNewIds(sourceChild.block)
    const insertionIndex = sourceIndex + 1
    const duplicatedLocation = cloneLocationForDuplicate(sourceChild.location, container, insertionIndex)

    addBlockToContainer(
      container,
      duplicatedBlock,
      options.parentLookup.value,
      duplicatedLocation,
      insertionIndex,
    )

    const duplicatedNode = findTreeNodeByBlockId(blockTree.value, duplicatedBlock.id)
    options.selectedBlockKeys.value = duplicatedNode ? [duplicatedNode.key] : []
    options.markDocumentChanged('action')
  }

  function cloneBlockWithNewIds(sourceBlock: CardBlock): CardBlock {
    const rawSourceBlock = toRaw(sourceBlock) as CardBlock
    const rootDisplayName = typeof rawSourceBlock.name === 'string' && rawSourceBlock.name.trim().length > 0
      ? rawSourceBlock.name.trim()
      : rawSourceBlock.id

    let duplicatedBlock: CardBlock
    try {
      duplicatedBlock = structuredClone(rawSourceBlock) as CardBlock
    } catch {
      duplicatedBlock = JSON.parse(JSON.stringify(rawSourceBlock)) as CardBlock
    }

    remapDuplicatedBlockIds(duplicatedBlock, true, rootDisplayName)
    return duplicatedBlock
  }

  function remapDuplicatedBlockIds(block: CardBlock, isRoot: boolean, rootDisplayName?: string) {
    block.id = `${block.type}-${crypto.randomUUID()}`

    if (isRoot) {
      const nextName = rootDisplayName && rootDisplayName.trim().length > 0
        ? rootDisplayName.trim()
        : (typeof block.name === 'string' && block.name.trim().length > 0 ? block.name.trim() : block.id)
      block.name = `${nextName} 副本`
    }

    if (!isBlockContainer(block)) {
      return
    }

    for (const child of block.children) {
      remapDuplicatedBlockIds(child.block, false)
    }
  }

  function cloneLocationForDuplicate(
    location: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    targetContainer: BlockContainer,
    insertionIndex: number,
  ): SimpleContainerLocationInfo | FlowContainerLocationInfo {
    if (targetContainer.type === 'flow-container-block') {
      return {
        type: 'flow-container-location',
        index: insertionIndex,
        align: location.type === 'flow-container-location' ? location.align : undefined,
      }
    }

    if (location.type === 'simple-container-location') {
      return { ...location }
    }

    return {
      type: 'simple-container-location',
      anchor: 'lt',
      x: 0,
      y: 0,
    }
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
