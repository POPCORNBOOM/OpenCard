/** Card structure operations and their key-only tree view projection. */
import { computed, toRaw, watch, type Ref } from 'vue'
import {
  createBlock,
  type CardBlock,
  type CardFace,
  type FlowContainerLocationInfo,
  type SimpleContainerLocationInfo,
} from '../../entities/card/model'
import {
  addBlockToContainer,
  isBlockContainer,
  moveBlockBetweenContainers,
  removeBlockFromContainer,
  type BlockContainer,
  type ParentLookup,
} from '../../entities/card/tree'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../shared/ui/tree/tree.types'
import { getBlockPresentation } from './blockPresentation'
import type { CdeDocumentChangeMode } from './useCdeDocumentState'

type CardLocation = SimpleContainerLocationInfo | FlowContainerLocationInfo

type IndexedBlock = {
  block: CardBlock
  location: CardLocation
}

type UseCdeTreeOpsOptions = {
  activeFace: Readonly<Ref<CardFace | null>>
  documentRevision: Readonly<Ref<number>>
  parentLookup: Ref<ParentLookup>
  selectedBlockKeys: Ref<string[]>
  getDefaultBlockName: (type: CardBlock['type']) => string
  refreshDocumentState: () => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode) => void
  readOnly?: Readonly<Ref<boolean>>
}

export function useCdeTreeOps(options: UseCdeTreeOpsOptions) {
  const blockIndex = computed(() => {
    options.documentRevision.value
    const index = new Map<string, IndexedBlock>()

    function visit(block: CardBlock, location: CardLocation): void {
      index.set(block.id, { block, location })
      if (!isBlockContainer(block)) return
      for (const child of block.children) visit(child.block, child.location)
    }

    for (const child of options.activeFace.value?.children ?? []) visit(child.block, child.location)
    return index
  })

  const blockTreeData = computed<OcTreeData>(() => {
    options.documentRevision.value
    const rootKeys: string[] = []
    const items = new Map<string, OcTreeItem>()
    const children = new Map<string, readonly string[]>()

    function visit(block: CardBlock): void {
      const childKeys = isBlockContainer(block) ? block.children.map((child) => child.block.id) : []
      const visibility = block.visible === 'false' ? 'hidden' : 'visible'
      const presentation = getBlockPresentation(block.type)
      items.set(block.id, {
        label: block.name?.trim() || block.id,
        icon: presentation.icon,
        iconTone: visibility === 'hidden' ? 'muted' : presentation.iconTone,
        renamable: true,
        draggable: true,
        actions: [
          visibility === 'hidden' ? 'show-block' : 'hide-block',
          isBlockContainer(block) ? 'container-more' : 'block-more',
        ],
        contextActions: [
          visibility === 'hidden' ? 'show-block' : 'hide-block',
          'rename',
          ...(isBlockContainer(block) ? ['add'] : []),
          'duplicate',
          'delete',
        ],
      })
      if (childKeys.length > 0) children.set(block.id, childKeys)
      if (isBlockContainer(block)) {
        for (const child of block.children) visit(child.block)
      }
    }

    for (const child of options.activeFace.value?.children ?? []) {
      rootKeys.push(child.block.id)
      visit(child.block)
    }
    return { rootKeys, items, children }
  })

  const selectedEntry = computed<IndexedBlock | null>(() => {
    const key = options.selectedBlockKeys.value[0]
    return key ? blockIndex.value.get(key) ?? null : null
  })
  const selectedBlock = computed(() => selectedEntry.value?.block ?? null)
  const selectedLocation = computed(() => selectedEntry.value?.location ?? null)

  watch(
    [blockIndex, options.selectedBlockKeys],
    ([index, selectedKeys]) => {
      const key = selectedKeys[0]
      const nextKeys = key && index.has(key) ? [key] : []
      if (selectedKeys.length === nextKeys.length && selectedKeys[0] === nextKeys[0]) return
      options.selectedBlockKeys.value = nextKeys
    },
    { immediate: true },
  )

  function selectKeys(keys: readonly string[]): void {
    const key = keys[0]
    options.selectedBlockKeys.value = key && blockIndex.value.has(key) ? [key] : []
  }

  function handleViewportBlockClick(blockId: string): void {
    selectKeys([blockId])
  }

  function clearSelection(): void {
    if (options.selectedBlockKeys.value.length > 0) options.selectedBlockKeys.value = []
  }

  function handleTreeIntent(intent: OcTreeIntent): void {
    switch (intent.type) {
      case 'selection.change':
        selectKeys(intent.selectedKeys)
        return
      case 'action.invoke':
        selectKeys([intent.key])
        if (options.readOnly?.value) return
        executeBlockAction(intent.actionKey, blockIndex.value.get(intent.key)?.block ?? null)
        return
      case 'rename.commit':
        if (options.readOnly?.value) return
        renameBlock(intent.key, intent.name)
        return
      case 'move.request':
        if (options.readOnly?.value) return
        moveBlock(intent.key, intent.targetKey, intent.position)
        return
      default:
        return
    }
  }

  function handleRootAction(actionKey: string): void {
    if (options.readOnly?.value) return
    const target = actionKey.endsWith('-selected') ? selectedBlock.value : null
    executeBlockAction(actionKey, target)
  }

  function executeBlockAction(actionKey: string, target: CardBlock | null): void {
    const targetContainer: BlockContainer | null = target && isBlockContainer(target) ? target : options.activeFace.value
    switch (actionKey) {
      case 'add-text-block':
        if (targetContainer) createBlockAt(targetContainer, 'text-block')
        return
      case 'add-markdown-text-block':
        if (targetContainer) createBlockAt(targetContainer, 'markdown-text-block')
        return
      case 'add-image-block':
        if (targetContainer) createBlockAt(targetContainer, 'image-block')
        return
      case 'add-qrcode-block':
        if (targetContainer) createBlockAt(targetContainer, 'qrcode-block')
        return
      case 'add-shape-block':
        if (targetContainer) createBlockAt(targetContainer, 'shape-block')
        return
      case 'add-simple-container-block':
        if (targetContainer) createBlockAt(targetContainer, 'simple-container-block')
        return
      case 'add-flow-container-block':
        if (targetContainer) createBlockAt(targetContainer, 'flow-container-block')
        return
      case 'duplicate':
      case 'duplicate-selected':
        if (target) duplicateBlock(target)
        return
      case 'delete':
      case 'delete-selected':
        if (target) deleteBlock(target)
        return
      case 'hide-block':
        if (target) setBlockVisibility(target, false)
        return
      case 'show-block':
        if (target) setBlockVisibility(target, true)
        return
    }
  }

  function setBlockVisibility(block: CardBlock, visible: boolean): void {
    const nextValue = visible ? 'true' : 'false'
    if (block.visible === nextValue) return
    block.visible = nextValue
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function renameBlock(key: string, name: string): void {
    const block = blockIndex.value.get(key)?.block
    const nextName = name.trim()
    if (!block || !nextName || block.name === nextName) return
    block.name = nextName
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function moveBlock(
    draggedKey: string,
    targetKey: string | null,
    position: 'before' | 'inside' | 'after',
  ): void {
    const draggedEntry = blockIndex.value.get(draggedKey)
    const targetEntry = targetKey ? blockIndex.value.get(targetKey) : null
    if (!draggedEntry || targetKey === draggedKey) return
    if (targetKey && isDescendantOf(targetKey, draggedKey)) return

    const sourceContainer = options.parentLookup.value.get(draggedKey)
    const targetContainer = resolveTargetContainer(targetEntry?.block ?? null, position)
    let insertionIndex = resolveInsertionIndex(targetEntry?.block ?? null, targetContainer, position)
    if (!sourceContainer || !targetContainer || insertionIndex === null) return

    if (sourceContainer === targetContainer) {
      const sourceIndex = sourceContainer.children.findIndex((child) => child.block.id === draggedKey)
      if (sourceIndex >= 0 && sourceIndex < insertionIndex) insertionIndex -= 1
    }

    const location = createDropLocation(draggedEntry.location, targetContainer, insertionIndex)
    const moved = moveBlockBetweenContainers(
      sourceContainer,
      targetContainer,
      draggedKey,
      options.parentLookup.value,
      location,
      insertionIndex,
    )
    if (!moved) return
    options.refreshDocumentState()
    options.selectedBlockKeys.value = [draggedKey]
    options.markDocumentChanged('action')
  }

  function isDescendantOf(targetKey: string, ancestorKey: string): boolean {
    let current = blockIndex.value.get(targetKey)?.block ?? null
    while (current) {
      if (current.id === ancestorKey) return true
      const parent = options.parentLookup.value.get(current.id)
      current = parent && parent.type !== 'card-face' ? parent : null
    }
    return false
  }

  function resolveTargetContainer(target: CardBlock | null, position: 'before' | 'inside' | 'after'): BlockContainer | null {
    if (!target) return position === 'inside' ? options.activeFace.value : null
    if (position === 'inside') return isBlockContainer(target) ? target : null
    return options.parentLookup.value.get(target.id) ?? null
  }

  function resolveInsertionIndex(
    target: CardBlock | null,
    targetContainer: BlockContainer | null,
    position: 'before' | 'inside' | 'after',
  ): number | null {
    if (!targetContainer) return null
    if (!target || position === 'inside') return targetContainer.children.length
    const targetIndex = targetContainer.children.findIndex((child) => child.block.id === target.id)
    if (targetIndex < 0) return null
    return position === 'before' ? targetIndex : targetIndex + 1
  }

  function createDropLocation(
    current: CardLocation,
    targetContainer: BlockContainer,
    insertionIndex: number,
  ): CardLocation {
    if (targetContainer.type === 'flow-container-block') {
      return {
        id: current.id ?? `flow-location-${crypto.randomUUID()}`,
        type: 'flow-container-location',
        index: String(insertionIndex),
        align: current.type === 'flow-container-location' ? current.align : undefined,
      }
    }
    if (current.type === 'simple-container-location') return { ...current }
    return {
      id: `simple-location-${crypto.randomUUID()}`,
      type: 'simple-container-location',
      anchor: 'lt',
      x: '0',
      y: '0',
    }
  }

  function createBlockAt(container: BlockContainer, type: CardBlock['type']): void {
    const name = options.getDefaultBlockName(type).trim() || undefined
    let block: CardBlock
    switch (type) {
      case 'text-block':
        block = createBlock('text-block', { name })
        break
      case 'markdown-text-block':
        block = createBlock('markdown-text-block', { name })
        break
      case 'image-block':
        block = createBlock('image-block', { name })
        break
      case 'qrcode-block':
        block = createBlock('qrcode-block', { name })
        break
      case 'shape-block':
        block = createBlock('shape-block', { name })
        break
      case 'simple-container-block':
        block = createBlock('simple-container-block', { name })
        break
      case 'flow-container-block':
        block = createBlock('flow-container-block', { name })
        break
    }
    addBlockToContainer(container, block, options.parentLookup.value)
    options.refreshDocumentState()
    options.selectedBlockKeys.value = [block.id]
    options.markDocumentChanged('action')
  }

  function deleteBlock(block: CardBlock): void {
    const container = options.parentLookup.value.get(block.id)
    if (!container || !removeBlockFromContainer(container, block.id, options.parentLookup.value)) return
    options.selectedBlockKeys.value = options.selectedBlockKeys.value.filter((key) => key !== block.id)
    options.refreshDocumentState()
    options.markDocumentChanged('action')
  }

  function duplicateBlock(block: CardBlock): void {
    const container = options.parentLookup.value.get(block.id)
    if (!container) return
    const sourceIndex = container.children.findIndex((child) => child.block.id === block.id)
    if (sourceIndex < 0) return
    const sourceChild = container.children[sourceIndex]
    const duplicated = cloneBlockWithNewIds(sourceChild.block)
    const insertionIndex = sourceIndex + 1
    const location = cloneLocationForDuplicate(sourceChild.location, container, insertionIndex)
    addBlockToContainer(container, duplicated, options.parentLookup.value, location, insertionIndex)
    options.refreshDocumentState()
    options.selectedBlockKeys.value = [duplicated.id]
    options.markDocumentChanged('action')
  }

  function cloneBlockWithNewIds(source: CardBlock): CardBlock {
    const raw = toRaw(source) as CardBlock
    const rootName = raw.name?.trim() || raw.id
    let duplicate: CardBlock
    try {
      duplicate = structuredClone(raw)
    } catch {
      duplicate = JSON.parse(JSON.stringify(raw)) as CardBlock
    }
    remapBlockIds(duplicate, true, rootName)
    return duplicate
  }

  function remapBlockIds(block: CardBlock, root: boolean, rootName: string): void {
    block.id = `${block.type}-${crypto.randomUUID()}`
    if (root) block.name = `${rootName} 副本`
    if (!isBlockContainer(block)) return
    for (const child of block.children) remapBlockIds(child.block, false, rootName)
  }

  function cloneLocationForDuplicate(
    location: CardLocation,
    targetContainer: BlockContainer,
    insertionIndex: number,
  ): CardLocation {
    if (targetContainer.type === 'flow-container-block') {
      return {
        id: `flow-location-${crypto.randomUUID()}`,
        type: 'flow-container-location',
        index: String(insertionIndex),
        align: location.type === 'flow-container-location' ? location.align : undefined,
      }
    }
    if (location.type === 'simple-container-location') {
      return { ...location, id: `simple-location-${crypto.randomUUID()}` }
    }
    return {
      id: `simple-location-${crypto.randomUUID()}`,
      type: 'simple-container-location',
      anchor: 'lt',
      x: '0',
      y: '0',
    }
  }

  return {
    blockTreeData,
    selectedBlock,
    selectedLocation,
    handleTreeIntent,
    handleRootAction,
    handleViewportBlockClick,
    clearSelection,
  }
}
