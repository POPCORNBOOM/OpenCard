import { ITreeNode } from "../components/ui/TreeNode.vue"
import { fillDefaults } from './propertyEditorSchema'
import type { PropertyEditorSchemaOverride } from './propertyEditorSchema'

// Block and document data models.
export type BaseBlock = {
    id: string
    name?: string
    width?: CSSValue
    height?: CSSValue
    outline?: string
    borderRadius?: CSSValue
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
export type TextWritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'

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
    writingMode?: TextWritingMode
}

export type ImageBlock = BaseBlock & {
    type: "image-block"
    image: string
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

function toRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}

function setIfDefined(target: Record<string, unknown>, key: string, value: unknown): void {
    if (value !== undefined) {
        target[key] = value
    }
}

function toRecordArray(value: unknown): Record<string, unknown>[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
}

function resolveBlockType(typeName: unknown): CardBlock['type'] {
    switch (typeName) {
        case 'text-block':
        case 'image-block':
        case 'simple-container-block':
        case 'flow-container-block':
            return typeName
        default:
            return 'text-block'
    }
}

function materializeSimpleContainerLocation(locationInput: unknown): SimpleContainerLocationInfo {
    return fillDefaults('simple-container-location', toRecord(locationInput)) as SimpleContainerLocationInfo
}

function materializeFlowContainerLocation(locationInput: unknown, fallbackIndex: number): FlowContainerLocationInfo {
    const source = toRecord(locationInput)
    const materialized = fillDefaults('flow-container-location', source) as FlowContainerLocationInfo
    if (!Object.prototype.hasOwnProperty.call(source, 'index') || source.index === null || source.index === undefined) {
        materialized.index = fallbackIndex
    }
    return materialized
}

function materializeInstanceData(rawData: unknown): Record<string, Record<string, unknown>> {
    const source = toRecord(rawData)
    const normalized: Record<string, Record<string, unknown>> = {}

    for (const [blockId, overrideValue] of Object.entries(source)) {
        normalized[blockId] = toRecord(overrideValue)
    }

    return normalized
}

function materializeCardInstanceRecord(instanceInput: unknown): CardInstanceRecord {
    const source = toRecord(instanceInput)
    const materialized = fillDefaults('card-instance-record', source) as CardInstanceRecord
    const instanceId = typeof materialized.id === 'string' && materialized.id.trim().length > 0
        ? materialized.id
        : createBlockId('instance')

    const instanceName = typeof materialized.name === 'string' && materialized.name.trim().length > 0
        ? materialized.name
        : instanceId

    return {
        ...materialized,
        id: instanceId,
        name: instanceName,
        data: materializeInstanceData(source.data),
    }
}

// Materialize one block into a render-safe view block with schema defaults.
export function toViewBlock(blockInput: unknown): CardBlock {
    const source = toRecord(blockInput)
    const type = resolveBlockType(source.type)
    const materialized = fillDefaults(type, source) as CardBlock
    const normalizedId = typeof materialized.id === 'string' && materialized.id.trim().length > 0
        ? materialized.id
        : createBlockId(type)

    switch (type) {
        case 'text-block':
        case 'image-block':
            return {
                ...materialized,
                id: normalizedId,
                type,
            } as CardBlock
        case 'simple-container-block': {
            const children = toRecordArray(source.children).map((childInput) => ({
                block: toViewBlock(childInput.block),
                location: materializeSimpleContainerLocation(childInput.location),
            }))

            return {
                ...materialized,
                id: normalizedId,
                type,
                children,
            } as CardBlock
        }
        case 'flow-container-block': {
            const children = toRecordArray(source.children).map((childInput, index) => ({
                block: toViewBlock(childInput.block),
                location: materializeFlowContainerLocation(childInput.location, index),
            }))

            return {
                ...materialized,
                id: normalizedId,
                type,
                children,
            } as CardBlock
        }
    }
}

// Materialize a raw document into a render-safe view document for UI usage.
export function toViewDoc(documentInput: unknown): CardDocument {
    const source = toRecord(documentInput)
    const materialized = fillDefaults('card-document', source) as CardDocument
    const documentId = typeof materialized.id === 'string' && materialized.id.trim().length > 0
        ? materialized.id
        : createBlockId('card-document')

    const children = toRecordArray(source.children).map((childInput) => ({
        block: toViewBlock(childInput.block),
        location: materializeSimpleContainerLocation(childInput.location),
    }))

    const instances = toRecordArray(source.instances).map((instanceInput) =>
        materializeCardInstanceRecord(instanceInput)
    )

    return {
        ...materialized,
        id: documentId,
        children,
        instances,
    }
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
    const block: Record<string, unknown> = {
        id: init.id ?? createBlockId(),
    }

    setIfDefined(block, 'name', init.name)
    setIfDefined(block, 'width', init.width)
    setIfDefined(block, 'height', init.height)
    setIfDefined(block, 'outline', init.outline)
    setIfDefined(block, 'borderRadius', init.borderRadius)
    setIfDefined(block, 'background', init.background)
    setIfDefined(block, 'translateX', init.translateX)
    setIfDefined(block, 'translateY', init.translateY)
    setIfDefined(block, 'scaleX', init.scaleX)
    setIfDefined(block, 'scaleY', init.scaleY)
    setIfDefined(block, 'transformAnchor', init.transformAnchor)
    setIfDefined(block, 'zIndex', init.zIndex)
    setIfDefined(block, 'rotation', init.rotation)
    setIfDefined(block, 'opacity', init.opacity)
    setIfDefined(block, 'customCss', init.customCss)

    return block as BaseBlock
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
    const block: Record<string, unknown> = {
        ...createBaseBlock({
            id: init.id ?? createBlockId('text-block'),
            name: init.name ?? getDefaultBlockName('text-block'),
            ...init,
        }),
        type: 'text-block',
        content: init.content ?? '',
        mode: init.mode ?? 'plain',
    }

    setIfDefined(block, 'fontSize', init.fontSize)
    setIfDefined(block, 'fontFamily', init.fontFamily)
    setIfDefined(block, 'fontWeight', init.fontWeight)
    setIfDefined(block, 'color', init.color)
    setIfDefined(block, 'textAlign', init.textAlign)
    setIfDefined(block, 'lineHeight', init.lineHeight)
    setIfDefined(block, 'writingMode', init.writingMode)

    return block as TextBlock
}

export function createImageBlock(init: ImageBlockInit = {}): ImageBlock {
    const block: Record<string, unknown> = {
        ...createBaseBlock({
            id: init.id ?? createBlockId('image-block'),
            name: init.name ?? getDefaultBlockName('image-block'),
            ...init,
        }),
        type: 'image-block',
        image: init.image ?? init.imagePath ?? '',
        fit: init.fit ?? 'cover',
    }

    setIfDefined(block, 'imagePath', init.imagePath)

    return block as ImageBlock
}

export function createSimpleContainerBlock(init: SimpleContainerBlockInit = {}): SimpleContainerBlock {
    const block: SimpleContainerBlock = {
        ...createBaseBlock({
            id: init.id ?? createBlockId('simple-container-block'),
            name: init.name ?? getDefaultBlockName('simple-container-block'),
            ...init,
        }),
        type: 'simple-container-block',
        children: init.children ? [...init.children] : [],
    }

    return block
}

export function createFlowContainerBlock(init: FlowContainerBlockInit = {}): FlowContainerBlock {
    const block: FlowContainerBlock = {
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

    return block
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

// Apply a single instance's overrides onto one block subtree recursively.
function mergeBlockOverride(block: CardBlock, instance: CardInstanceRecord): CardBlock {
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
                    block: mergeBlockOverride(child.block, instance),
                })),
            }
        case 'flow-container-block':
            return {
                ...block,
                ...overrides,
                children: block.children.map((child) => ({
                    location: { ...child.location },
                    block: mergeBlockOverride(child.block, instance),
                })),
            }
    }
}

// Project one instance onto the blueprint document to produce an overridden tree.
export function applyInstance(
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
            block: mergeBlockOverride(child.block, instance),
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
