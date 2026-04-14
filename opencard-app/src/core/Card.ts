import { ITreeNode } from "../components/ui/TreeNode.vue"
import type { PropertyEditorSchemaOverride } from './propertyEditorSchema'

// Block and document data models.
export type BaseBlock = {
    id: string
    name?: string
    width?: CSSValue
    height?: CSSValue
    background?: string
    translateX?: CSSValue
    translateY?: CSSValue
    scaleX?: number
    scaleY?: number
    transformAnchor?: AnchorPosition
    zIndex?: number
    rotation?: number
    opacity?: number
    customCss?: string
}

export type CSSValue = number | string

export type AnchorPosition =
    | 'lt' | 'ct' | 'rt'
    | 'lc' | 'cc' | 'rc'
    | 'lb' | 'cb' | 'rb'

export type AlignmentPosition = 'start' | 'center' | 'end' | 'justify'

export type TextBlock = BaseBlock & {
    type: "text-block"
    content: string
    mode: 'plain' | 'markdown' | 'richtext'
    fontSize?: CSSValue
    fontFamily?: string
    fontWeight?: 'normal' | 'bold' | number
    color?: string
    textAlign?: AlignmentPosition
    lineHeight?: CSSValue
}

export type ImageBlock = BaseBlock & {
    type: "image-block"
    image?: string
    assetId?: string
    imagePath?: string
    fit: "cover" | "contain" | "fill"
}

export type SimpleContainerLocationInfo = {
    type: 'simple-container-location'
    anchor: AnchorPosition
    x?: CSSValue
    y?: CSSValue
}

export type SimpleContainerBlock = BaseBlock & {
    type: "simple-container-block"
    children: {
        block: CardBlock
        location: SimpleContainerLocationInfo
    }[]
}

export type FlowContainerLocationInfo = {
    type: 'flow-container-location'
    index: number
    align?: AlignmentPosition
}

export type FlowDirection = 'lr' | 'rl' | 'tb' | 'bt'

export type FlowContainerBlock = BaseBlock & {
    type: "flow-container-block"
    direction: FlowDirection
    gap: CSSValue
    children: {
        block: CardBlock
        location: FlowContainerLocationInfo
    }[]
}

export type CardBlock = TextBlock | ImageBlock | SimpleContainerBlock | FlowContainerBlock

export type RootChild = {
    block: CardBlock
    location: SimpleContainerLocationInfo
}

export type CardDocument = {
    type: "card-document"
    name: string
    id: string
    version: 1
    width: number
    height: number
    children: RootChild[]
    instances?: CardInstanceRecord[]
}

export type CardInstanceRecord = {
    id: string
    name: string
    metadata?: Record<string, unknown>
    data: Record<string, Record<string, unknown>>
}

export type PropertyEditorTarget = Record<string, unknown> & {
    type?: string
}

export type PropertyEditorSource = {
    title: string
    target: PropertyEditorTarget
    schemaOverride?: PropertyEditorSchemaOverride
}

// Extra data attached when a block is projected into the editor tree.
export type CardTreeNodeMetadata = {
    block: CardBlock
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
}

// Internal helper types for block factory functions.
type BlockInit = Pick<BaseBlock, 'id'> & Partial<Omit<BaseBlock, 'id'>>
type TextBlockInit = Partial<Omit<TextBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type ImageBlockInit = Partial<Omit<ImageBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type SimpleContainerBlockInit = Partial<Omit<SimpleContainerBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type FlowContainerBlockInit = Partial<Omit<FlowContainerBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>

// Shared block creation helpers.
function createBlockId(prefix = 'block'): string {
    return `${prefix}-${crypto.randomUUID()}`
}

function createBaseBlock(init: BlockInit = { id: createBlockId() }): BaseBlock {
    return {
        id: init.id ?? createBlockId(),
        name: init.name,
        width: init.width,
        height: init.height,
        background: init.background,
        zIndex: init.zIndex,
        rotation: init.rotation,
        opacity: init.opacity,
    }
}

function getDefaultBlockName(type: CardBlock['type']): string {
    switch (type) {
        case 'text-block':
            return 'Text Block'
        case 'image-block':
            return 'Image Block'
        case 'simple-container-block':
            return 'Simple Container'
        case 'flow-container-block':
            return 'Flow Container'
    }
}

export function createTextBlock(init: TextBlockInit = {}): TextBlock {
    return {
        ...createBaseBlock({
            id: init.id ?? createBlockId('text-block'),
            name: init.name ?? getDefaultBlockName('text-block'),
            ...init,
        }),
        type: 'text-block',
        content: init.content ?? '',
        mode: init.mode ?? 'plain',
        fontSize: init.fontSize,
        fontFamily: init.fontFamily,
        fontWeight: init.fontWeight,
        color: init.color,
        textAlign: init.textAlign,
    }
}

export function createImageBlock(init: ImageBlockInit = {}): ImageBlock {
    return {
        ...createBaseBlock({
            id: init.id ?? createBlockId('image-block'),
            name: init.name ?? getDefaultBlockName('image-block'),
            ...init,
        }),
        type: 'image-block',
        image: init.image ?? init.imagePath ?? init.assetId,
        assetId: init.assetId,
        imagePath: init.imagePath,
        fit: init.fit ?? 'cover',
    }
}

export function createSimpleContainerBlock(init: SimpleContainerBlockInit = {}): SimpleContainerBlock {
    return {
        ...createBaseBlock({
            id: init.id ?? createBlockId('simple-container-block'),
            name: init.name ?? getDefaultBlockName('simple-container-block'),
            ...init,
        }),
        type: 'simple-container-block',
        children: init.children ? [...init.children] : [],
    }
}

export function createFlowContainerBlock(init: FlowContainerBlockInit = {}): FlowContainerBlock {
    return {
        ...createBaseBlock({
            id: init.id ?? createBlockId('flow-container-block'),
            name: init.name ?? getDefaultBlockName('flow-container-block'),
            ...init,
        }),
        type: 'flow-container-block',
        direction: init.direction ?? 'lr',
        gap: init.gap ?? '10px',
        children: init.children ? [...init.children] : [],
    }
}

export function createBlock(type: 'text-block', init?: TextBlockInit): TextBlock
export function createBlock(type: 'image-block', init?: ImageBlockInit): ImageBlock
export function createBlock(type: 'simple-container-block', init?: SimpleContainerBlockInit): SimpleContainerBlock
export function createBlock(type: 'flow-container-block', init?: FlowContainerBlockInit): FlowContainerBlock
export function createBlock(type: CardBlock['type'], init: unknown = {}): CardBlock {
    switch (type) {
        case 'text-block':
            return createTextBlock(init as TextBlockInit)
        case 'image-block':
            return createImageBlock(init as ImageBlockInit)
        case 'simple-container-block':
            return createSimpleContainerBlock(init as SimpleContainerBlockInit)
        case 'flow-container-block':
            return createFlowContainerBlock(init as FlowContainerBlockInit)
    }
}

export type BlockContainer = SimpleContainerBlock | FlowContainerBlock | CardDocument
export type ParentLookup = Map<string, BlockContainer>

// Default child placement for each container type.
function createDefaultSimpleContainerLocation(): SimpleContainerLocationInfo {
    return {
        type: 'simple-container-location',
        anchor: 'lt',
        x: 0,
        y: 0,
    }
}

function createDefaultFlowContainerLocation(container: FlowContainerBlock): FlowContainerLocationInfo {
    return {
        type: 'flow-container-location',
        index: container.children.length,
    }
}

// Runtime lookup for finding a block's parent container in O(1).
export function buildParentLookup(document: CardDocument): ParentLookup {
    const lookup: ParentLookup = new Map()

    for (const child of document.children) {
        registerBlockSubtree(child.block, document, lookup)
    }

    return lookup
}

function registerBlockSubtree(
    block: CardBlock,
    parentContainer: BlockContainer,
    lookup: ParentLookup
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

function createDefaultLocationForContainer(container: BlockContainer): SimpleContainerLocationInfo | FlowContainerLocationInfo {
    if (container.type === 'flow-container-block') {
        return createDefaultFlowContainerLocation(container)
    }

    return createDefaultSimpleContainerLocation()
}

function normalizeLocationForContainer(
    container: BlockContainer,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
): SimpleContainerLocationInfo | FlowContainerLocationInfo {
    if (container.type === 'flow-container-block') {
        return location?.type === 'flow-container-location'
            ? location
            : createDefaultFlowContainerLocation(container)
    }

    return location?.type === 'simple-container-location'
        ? location
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
        child.location.index = index
    })
}

function attachBlockToContainer(
    container: BlockContainer,
    childBlock: CardBlock,
    location: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    parentLookup?: ParentLookup,
    insertionIndex?: number
): void {
    if (parentLookup) {
        registerBlockSubtree(childBlock, container, parentLookup)
    }

    switch (container.type) {
        case 'card-document':
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
            return
    }
}

// Structural mutation helpers. Keep all parent/child changes inside these functions.
export function addBlockToContainer(
    container: BlockContainer,
    childBlock: CardBlock,
    parentLookup?: ParentLookup,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    insertionIndex?: number
): void {
    const nextLocation = normalizeLocationForContainer(container, location)
    attachBlockToContainer(container, childBlock, nextLocation, parentLookup, insertionIndex)
}

export function removeBlockFromContainer(
    container: BlockContainer,
    childBlockId: string,
    parentLookup?: ParentLookup
): CardBlock | null {
    const index = container.children.findIndex(child => child.block.id === childBlockId)
    if (index !== -1) {
        const [removedChild] = container.children.splice(index, 1)
        if (container.type === 'flow-container-block') {
            reindexFlowContainerChildren(container)
        }
        if (parentLookup) {
            unregisterBlockSubtree(removedChild.block, parentLookup)
        }
        return removedChild.block
    }

    return null
}

export function moveBlockBetweenContainers(
    sourceContainer: BlockContainer,
    targetContainer: BlockContainer,
    childBlockId: string,
    parentLookup?: ParentLookup,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo,
    insertionIndex?: number
): CardBlock | null {
    const block = removeBlockFromContainer(sourceContainer, childBlockId, parentLookup)
    if (!block) {
        return null
    }

    const nextLocation = location ?? createDefaultLocationForContainer(targetContainer)
    addBlockToContainer(targetContainer, block, parentLookup, nextLocation, insertionIndex)
    return block
}

export function isBlockContainer(target: CardBlock | CardDocument): target is BlockContainer {
    return target.type === 'simple-container-block' || target.type === 'flow-container-block' || target.type === 'card-document'
}

export function isCardBlock(target: any): target is CardBlock {
    //检查对象的type属性是否以-block结尾，以区分是否为CardBlock类型
    return target && typeof target === 'object' && typeof target.type === 'string' && target.type.endsWith('-block')
}

export function getBlockTreeIcon(type: CardBlock['type']): string {
    switch (type) {
        case 'text-block':
            return 'codicon-file-text'
        case 'image-block':
            return 'codicon-file-media'
        case 'simple-container-block':
            return 'codicon-collection'
        case 'flow-container-block':
            return 'codicon-layers'
    }
}

function cloneBlockWithInstanceData(block: CardBlock, instance: CardInstanceRecord): CardBlock {
    const overrides = instance.data[block.id] ?? {}

    switch (block.type) {
        case 'text-block':
            return {
                ...block,
                ...overrides,
            }
        case 'image-block':
            return {
                ...block,
                ...overrides,
            }
        case 'simple-container-block':
            return {
                ...block,
                ...overrides,
                children: block.children.map((child) => ({
                    location: { ...child.location },
                    block: cloneBlockWithInstanceData(child.block, instance),
                })),
            }
        case 'flow-container-block':
            return {
                ...block,
                ...overrides,
                children: block.children.map((child) => ({
                    location: { ...child.location },
                    block: cloneBlockWithInstanceData(child.block, instance),
                })),
            }
    }
}

export function resolveCardDocumentInstanceView(
    document: CardDocument,
    instance: CardInstanceRecord | null
): CardDocument {
    if (!instance) {
        return document
    }

    return {
        ...document,
        children: document.children.map((child) => ({
            location: { ...child.location },
            block: cloneBlockWithInstanceData(child.block, instance),
        })),
    }
}

// Conversion from card blocks to the generic tree node structure used by the editor UI.
export const blockToTreeNode = (
    block: CardBlock,
    parent: ITreeNode | null,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
): ITreeNode => {
    const newNode: ITreeNode = {
        name: block.name?.trim() || block.id,
        key: block.id,
        path: parent?.path ? [...parent.path, block.id] : [block.id],
        parent,
        isExpandable: isBlockContainer(block),
        icon: getBlockTreeIcon(block.type),
        actionKeys: isBlockContainer(block) ? ['add', 'delete'] : ['delete'], // 应该是container有add，任何block都有delete
        metadata: { block, location } satisfies CardTreeNodeMetadata,
    }

    if (isBlockContainer(block)) {
        newNode.children = block.children.map(child => blockToTreeNode(child.block, newNode, child.location))
    }

    return newNode
}
