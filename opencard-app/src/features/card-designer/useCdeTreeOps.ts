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
  isBlockPackaged,
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
  order: number
}

type UseCdeTreeOpsOptions = {
  activeFace: Readonly<Ref<CardFace | null>>
  documentRevision: Readonly<Ref<number>>
  parentLookup: Ref<ParentLookup>
  selectedBlockKeys: Ref<string[]>
  getDefaultBlockName: (type: CardBlock['type']) => string
  createCustomBlock?: (key: string) => CardBlock | null
  refreshDocumentState: (structural?: boolean) => void
  markDocumentChanged: (mode?: CdeDocumentChangeMode, target?: string, structural?: boolean) => void
}

export function useCdeTreeOps(options: UseCdeTreeOpsOptions) {
  const blockIndex = computed(() => {
    options.documentRevision.value
    const index = new Map<string, IndexedBlock>()
    let order = 0

    function visit(block: CardBlock, location: CardLocation): void {
      index.set(block.id, { block, location, order })
      order += 1
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
      const packaged = isBlockPackaged(block)
      const childKeys = isBlockContainer(block) && !packaged
        ? block.children.map((child) => child.block.id)
        : []
      const visibility = block.visible === 'false' ? 'hidden' : 'visible'
      const presentation = getBlockPresentation(block.type)
      items.set(block.id, {
        label: block.name?.trim() || block.id,
        icon: packaged ? 'entity.block-package' : presentation.icon,
        iconTone: visibility === 'hidden' ? 'muted' : presentation.iconTone,
        renamable: true,
        draggable: true,
        actions: [
          visibility === 'hidden' ? 'show-block' : 'hide-block',
          isBlockContainer(block)
            ? (packaged ? 'packaged-container-more' : 'container-more')
            : 'block-more',
        ],
        contextActions: [
          visibility === 'hidden' ? 'show-block' : 'hide-block',
          'rename',
          'export-custom-block',
          ...(isBlockContainer(block) ? (packaged ? ['unpackage'] : ['add', 'package']) : []),
          'duplicate',
          'delete',
        ],
      })
      if (childKeys.length > 0) children.set(block.id, childKeys)
      if (isBlockContainer(block) && !packaged) {
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
    if (options.selectedBlockKeys.value.length !== 1) return null
    const key = options.selectedBlockKeys.value[0]
    return key ? blockIndex.value.get(key) ?? null : null
  })
  const selectedBlock = computed(() => selectedEntry.value?.block ?? null)
  const selectedLocation = computed(() => selectedEntry.value?.location ?? null)

  function getBlockById(blockId: string): CardBlock | null {
    return blockIndex.value.get(blockId)?.block ?? null
  }

  function resolveVisibleBlockKey(blockId: string): string | null {
    const customHostId = blockId.includes('::block:') ? blockId.slice(0, blockId.indexOf('::block:')) : blockId
    let current = blockIndex.value.get(customHostId)?.block ?? null
    if (!current) return null

    let visibleKey = current.id
    while (current) {
      const parent = options.parentLookup.value.get(current.id)
      if (!parent || parent.type === 'card-face') break
      if (isBlockPackaged(parent)) visibleKey = parent.id
      current = parent
    }
    return visibleKey
  }

  watch(
    [blockIndex, options.selectedBlockKeys],
    ([index, selectedKeys]) => {
      const nextKeys = normalizeVisibleSelectionKeys(selectedKeys, index)
      if (
        selectedKeys.length === nextKeys.length
        && selectedKeys.every((key, index) => key === nextKeys[index])
      ) return
      options.selectedBlockKeys.value = nextKeys
    },
    { immediate: true },
  )

  function selectKeys(keys: readonly string[]): void {
    options.selectedBlockKeys.value = normalizeVisibleSelectionKeys(keys, blockIndex.value)
  }

  function normalizeVisibleSelectionKeys(
    keys: readonly string[],
    index: ReadonlyMap<string, IndexedBlock>,
  ): string[] {
    const normalized: string[] = []
    const seen = new Set<string>()
    for (const key of keys) {
      const visibleKey = resolveVisibleBlockKey(key)
      if (!visibleKey || !index.has(visibleKey) || seen.has(visibleKey)) continue
      seen.add(visibleKey)
      normalized.push(visibleKey)
    }
    return normalized
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
        if (intent.actionKey === 'delete' && options.selectedBlockKeys.value.includes(intent.key)) {
          deleteBlocks(options.selectedBlockKeys.value)
          return
        }
        selectKeys([intent.key])
        executeBlockAction(intent.actionKey, blockIndex.value.get(intent.key)?.block ?? null)
        return
      case 'rename.commit':
        renameBlock(intent.key, intent.name)
        return
      case 'move.request':
        moveBlocks(
          options.selectedBlockKeys.value.includes(intent.key)
            ? options.selectedBlockKeys.value
            : [intent.key],
          intent.targetKey,
          intent.position,
        )
        return
      default:
        return
    }
  }

  function handleRootAction(actionKey: string): void {
    if (actionKey === 'delete-selected') {
      deleteBlocks(options.selectedBlockKeys.value)
      return
    }
    const target = actionKey.endsWith('-selected') ? selectedBlock.value : null
    executeBlockAction(actionKey, target)
  }

  function executeBlockAction(actionKey: string, target: CardBlock | null): void {
    const targetContainer: BlockContainer | null = target && isBlockContainer(target) && !isBlockPackaged(target)
      ? target
      : target ? null : options.activeFace.value
    if (actionKey.startsWith('add-custom-block:')) {
      const block = options.createCustomBlock?.(actionKey.slice('add-custom-block:'.length)) ?? null
      if (targetContainer && block) insertBlockAt(targetContainer, block)
      return
    }
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
        if (target) deleteBlocks([target.id])
        return
      case 'hide-block':
        if (target) setBlockVisibility(target, false)
        return
      case 'show-block':
        if (target) setBlockVisibility(target, true)
        return
      case 'package':
        if (target && isBlockContainer(target)) setBlockPackaged(target, true)
        return
      case 'unpackage':
        if (target && isBlockContainer(target)) setBlockPackaged(target, false)
        return
    }
  }

  function setBlockPackaged(block: Exclude<BlockContainer, CardFace>, packaged: boolean): void {
    if (isBlockPackaged(block) === packaged) return
    if (packaged) block.packaged = 'true'
    else delete block.packaged
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'structure-tree', true)
  }

  function setBlockVisibility(block: CardBlock, visible: boolean): void {
    const nextValue = visible ? 'true' : 'false'
    if (block.visible === nextValue) return
    block.visible = nextValue
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'structure-tree', true)
  }

  function renameBlock(key: string, name: string): void {
    const block = blockIndex.value.get(key)?.block
    const nextName = name.trim()
    if (!block || !nextName || block.name === nextName) return
    block.name = nextName
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'structure-tree', true)
  }

  function moveBlocks(
    requestedKeys: readonly string[],
    targetKey: string | null,
    position: 'before' | 'inside' | 'after',
  ): void {
    const selectedKeys = normalizeVisibleSelectionKeys(requestedKeys, blockIndex.value)
    const movedKeys = resolveTopLevelSelectionKeys(selectedKeys)
    const targetEntry = targetKey ? blockIndex.value.get(targetKey) : null
    if (movedKeys.length === 0 || (targetKey && !targetEntry)) return
    if (targetKey && movedKeys.some(key => targetKey === key || isDescendantOf(targetKey, key))) return

    const targetContainer = resolveTargetContainer(targetEntry?.block ?? null, position)
    let insertionIndex = resolveInsertionIndex(targetEntry?.block ?? null, targetContainer, position)
    if (!targetContainer || insertionIndex === null || isBlockPackaged(targetContainer)) return

    const entries = movedKeys.flatMap((key) => {
      const indexed = blockIndex.value.get(key)
      const sourceContainer = options.parentLookup.value.get(key)
      const sourceIndex = sourceContainer?.children.findIndex(child => child.block.id === key) ?? -1
      return indexed && sourceContainer && sourceIndex >= 0
        ? [{ key, ...indexed, sourceContainer, sourceIndex }]
        : []
    })
    if (entries.length !== movedKeys.length) return

    insertionIndex -= entries.filter(entry => (
      entry.sourceContainer === targetContainer && entry.sourceIndex < insertionIndex!
    )).length

    for (const entry of entries) {
      removeBlockFromContainer(entry.sourceContainer, entry.key, options.parentLookup.value)
    }
    entries.forEach((entry, offset) => {
      const nextIndex = insertionIndex! + offset
      addBlockToContainer(
        targetContainer,
        entry.block,
        options.parentLookup.value,
        createDropLocation(entry.location, targetContainer, nextIndex),
        nextIndex,
      )
    })

    options.refreshDocumentState(true)
    selectKeys(selectedKeys)
    options.markDocumentChanged('action', 'structure-tree', true)
  }

  function resolveTopLevelSelectionKeys(keys: readonly string[]): string[] {
    const selected = new Set(keys)
    return [...selected]
      .filter((key) => {
        let parent = options.parentLookup.value.get(key)
        while (parent && parent.type !== 'card-face') {
          if (selected.has(parent.id)) return false
          parent = options.parentLookup.value.get(parent.id)
        }
        return true
      })
      .sort((left, right) => (
        (blockIndex.value.get(left)?.order ?? Number.MAX_SAFE_INTEGER)
        - (blockIndex.value.get(right)?.order ?? Number.MAX_SAFE_INTEGER)
      ))
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
    if (position === 'inside') return isBlockContainer(target) && !isBlockPackaged(target) ? target : null
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
    if (isBlockPackaged(container)) return
    if (type === 'custom-block') return
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
    insertBlockAt(container, block)
  }

  function insertBlockAt(container: BlockContainer, block: CardBlock): void {
    if (isBlockPackaged(container)) return
    addBlockToContainer(container, block, options.parentLookup.value)
    options.refreshDocumentState(true)
    options.selectedBlockKeys.value = [block.id]
    options.markDocumentChanged('action', 'structure-tree', true)
  }

  function insertBlockAtRoot(block: CardBlock): boolean {
    const face = options.activeFace.value
    if (!face) return false
    addBlockToContainer(face, block, options.parentLookup.value)
    options.refreshDocumentState(true)
    options.selectedBlockKeys.value = [block.id]
    options.markDocumentChanged('action', 'structure-tree', true)
    return true
  }

  function deleteBlocks(requestedKeys: readonly string[]): void {
    const keys = resolveTopLevelSelectionKeys(
      normalizeVisibleSelectionKeys(requestedKeys, blockIndex.value),
    )
    const targets = keys.flatMap((key) => {
      const container = options.parentLookup.value.get(key)
      return container?.children.some(child => child.block.id === key)
        ? [{ key, container }]
        : []
    })
    if (targets.length !== keys.length || targets.length === 0) return

    for (const target of targets) {
      removeBlockFromContainer(target.container, target.key, options.parentLookup.value)
    }
    options.selectedBlockKeys.value = []
    options.refreshDocumentState(true)
    options.markDocumentChanged('action', 'structure-tree', true)
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
    options.refreshDocumentState(true)
    options.selectedBlockKeys.value = [duplicated.id]
    options.markDocumentChanged('action', 'structure-tree', true)
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
    getBlockById,
    insertBlockAtRoot,
    handleTreeIntent,
    handleRootAction,
    handleViewportBlockClick,
    resolveVisibleBlockKey,
    clearSelection,
  }
}
