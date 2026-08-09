/** Card block tree topology, parent lookup, and structural mutations. */
import { fillDefaults } from './schema'
import type {
    CardBlock,
    CardDocument,
    CardFace,
    CardFaceKey,
    FlowContainerBlock,
    FlowContainerLocationInfo,
    SimpleContainerBlock,
    SimpleContainerLocationInfo,
} from './model'

export type BlockContainer = SimpleContainerBlock | FlowContainerBlock | CardFace
export type ParentLookup = Map<string, BlockContainer>

function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

function createLocationId(prefix: 'simple-location' | 'flow-location'): string {
    return `${prefix}-${crypto.randomUUID()}`
}

function materializeSimpleContainerLocation(locationInput: unknown): SimpleContainerLocationInfo {
    const source = toRecord(locationInput)
    const materialized = fillDefaults('simple-container-location', source) as SimpleContainerLocationInfo
    const locationId = toNonEmptyString(source.id)
        ?? toNonEmptyString(materialized.id)
        ?? createLocationId('simple-location')
    materialized.id = locationId
    return materialized
}

function materializeFlowContainerLocation(
    locationInput: unknown,
    fallbackIndex: string,
): FlowContainerLocationInfo {
    const source = toRecord(locationInput)
    const materialized = fillDefaults('flow-container-location', source) as FlowContainerLocationInfo
    const locationId = toNonEmptyString(source.id)
        ?? toNonEmptyString(materialized.id)
        ?? createLocationId('flow-location')
    materialized.id = locationId
    if (!Object.prototype.hasOwnProperty.call(source, 'index') || source.index === null || source.index === undefined) {
        materialized.index = fallbackIndex
    }
    return materialized
}

function createDefaultSimpleContainerLocation(): SimpleContainerLocationInfo {
    return {
        id: createLocationId('simple-location'),
        type: 'simple-container-location',
        anchor: 'lt',
        x: '0',
        y: '0',
    }
}

function createDefaultFlowContainerLocation(container: FlowContainerBlock): FlowContainerLocationInfo {
    return {
        id: createLocationId('flow-location'),
        type: 'flow-container-location',
        index: String(container.children.length),
    }
}

export function isBlockContainer(target: CardBlock | CardFace): target is BlockContainer {
    return target.type === 'simple-container-block'
        || target.type === 'flow-container-block'
        || target.type === 'card-face'
}

export function isBlockPackaged(target: CardBlock | CardFace): boolean {
    return target.type !== 'card-face'
        && isBlockContainer(target)
        && target.packaged === 'true'
}

export function visitCardBlockTree(
    root: CardBlock,
    visit: (
        block: CardBlock,
        depth: number,
        location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    ) => void,
): void {
    const traverse = (
        block: CardBlock,
        depth: number,
        location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    ): void => {
        visit(block, depth, location)
        if (!isBlockContainer(block)) return
        for (const child of block.children) traverse(child.block, depth + 1, child.location)
    }
    traverse(root, 0)
}

export type LocatedCardBlock = {
    block: CardBlock
    faceKey: CardFaceKey
}

export function findCardBlockInDocument(
    document: CardDocument,
    blockId: string,
): LocatedCardBlock | null {
    for (const [faceKey, face] of Object.entries(document.faces) as [CardFaceKey, CardFace][]) {
        for (const child of face.children) {
            let found: CardBlock | null = null
            visitCardBlockTree(child.block, block => {
                if (!found && block.id === blockId) found = block
            })
            if (found) return { block: found, faceKey }
        }
    }
    return null
}

function registerBlockSubtree(
    block: CardBlock,
    parentContainer: BlockContainer,
    lookup: ParentLookup,
): void {
    lookup.set(block.id, parentContainer)

    if (!isBlockContainer(block)) {
        return
    }

    for (const child of block.children) {
        registerBlockSubtree(child.block, block, lookup)
    }
}

function unregisterBlockSubtree(block: CardBlock, lookup: ParentLookup): void {
    lookup.delete(block.id)

    if (!isBlockContainer(block)) {
        return
    }

    for (const child of block.children) {
        unregisterBlockSubtree(child.block, lookup)
    }
}

export function buildParentLookup(document: CardDocument): ParentLookup {
    const lookup: ParentLookup = new Map()

    for (const face of Object.values(document.faces)) {
        for (const child of face.children) {
            registerBlockSubtree(child.block, face, lookup)
        }
    }

    return lookup
}

function createDefaultLocationForContainer(
    container: BlockContainer,
): SimpleContainerLocationInfo | FlowContainerLocationInfo {
    if (container.type === 'flow-container-block') {
        return createDefaultFlowContainerLocation(container)
    }

    return createDefaultSimpleContainerLocation()
}

function normalizeLocationForContainer(
    container: BlockContainer,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
): SimpleContainerLocationInfo | FlowContainerLocationInfo {
    if (container.type === 'flow-container-block') {
        return location?.type === 'flow-container-location'
            ? materializeFlowContainerLocation(location, location.index)
            : createDefaultFlowContainerLocation(container)
    }

    return location?.type === 'simple-container-location'
        ? materializeSimpleContainerLocation(location)
        : createDefaultSimpleContainerLocation()
}

function clampInsertionIndex(index: number | undefined, length: number): number {
    if (index === undefined) {
        return length
    }

    return Math.min(Math.max(index, 0), length)
}

function reindexFlowContainerChildren(container: FlowContainerBlock): void {
    container.children.forEach((child, index) => {
        child.location.index = String(index)
    })
}

function attachBlockToContainer(
    container: BlockContainer,
    childBlock: CardBlock,
    location: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    parentLookup?: ParentLookup,
    insertionIndex?: number,
): void {
    if (parentLookup) {
        registerBlockSubtree(childBlock, container, parentLookup)
    }

    switch (container.type) {
        case 'card-face':
        case 'simple-container-block':
            container.children.splice(clampInsertionIndex(insertionIndex, container.children.length), 0, {
                block: childBlock,
                location: location as SimpleContainerLocationInfo,
            })
            return
        case 'flow-container-block':
            container.children.splice(clampInsertionIndex(insertionIndex, container.children.length), 0, {
                block: childBlock,
                location: location as FlowContainerLocationInfo,
            })
            reindexFlowContainerChildren(container)
    }
}

export function addBlockToContainer(
    container: BlockContainer,
    childBlock: CardBlock,
    parentLookup?: ParentLookup,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    insertionIndex?: number,
): void {
    const nextLocation = normalizeLocationForContainer(container, location)
    attachBlockToContainer(container, childBlock, nextLocation, parentLookup, insertionIndex)
}

export function removeBlockFromContainer(
    container: BlockContainer,
    childBlockId: string,
    parentLookup?: ParentLookup,
): CardBlock | null {
    const index = container.children.findIndex(child => child.block.id === childBlockId)
    if (index === -1) {
        return null
    }

    const [removedChild] = container.children.splice(index, 1)
    if (container.type === 'flow-container-block') {
        reindexFlowContainerChildren(container)
    }
    if (parentLookup) {
        unregisterBlockSubtree(removedChild.block, parentLookup)
    }
    return removedChild.block
}

export function moveBlockBetweenContainers(
    sourceContainer: BlockContainer,
    targetContainer: BlockContainer,
    childBlockId: string,
    parentLookup?: ParentLookup,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    insertionIndex?: number,
): CardBlock | null {
    const block = removeBlockFromContainer(sourceContainer, childBlockId, parentLookup)
    if (!block) {
        return null
    }

    const nextLocation = location ?? createDefaultLocationForContainer(targetContainer)
    addBlockToContainer(targetContainer, block, parentLookup, nextLocation, insertionIndex)
    return block
}
