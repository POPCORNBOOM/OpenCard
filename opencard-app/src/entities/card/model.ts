/**
 * 模块说明：
 * - 定义卡牌领域模型 物化转换 树结构操作与实例投影
 * 职责边界：
 * - 维护领域结构真相 不包含组件渲染实现
 */
import type { TreeItem } from '../../shared/ui/tree/tree.types'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import { fillDefaults, isReferenceFieldReadable } from './schema'
import type { PropertyEditorSchemaOverride } from './schema'

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
    contentAnchor?: AnchorPosition
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
    id: string
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
    id: string
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
    version: string
    width: number
    height: number
    background: string
    children: RootChild[]
    instances: CardInstanceRecord[]
}

export type CardInstanceRecord = {
    type: 'card-instance'
    id: string
    name: string
    amount: number
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

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    if (trimmed.length === 0) {
        return null
    }

    return trimmed
}

function toFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
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
    const source = toRecord(locationInput)
    const materialized = fillDefaults('simple-container-location', source) as SimpleContainerLocationInfo
    const locationId = toNonEmptyString(source.id) ?? toNonEmptyString(materialized.id) ?? createBlockId('simple-location')
    materialized.id = locationId
    return materialized
}

function materializeFlowContainerLocation(locationInput: unknown, fallbackIndex: number): FlowContainerLocationInfo {
    const source = toRecord(locationInput)
    const materialized = fillDefaults('flow-container-location', source) as FlowContainerLocationInfo
    const locationId = toNonEmptyString(source.id) ?? toNonEmptyString(materialized.id) ?? createBlockId('flow-location')
    materialized.id = locationId
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
    const materialized = fillDefaults('card-instance', source) as CardInstanceRecord
    const instanceId = typeof materialized.id === 'string' && materialized.id.trim().length > 0
        ? materialized.id
        : createBlockId('instance')

    const instanceName = typeof materialized.name === 'string' && materialized.name.trim().length > 0
        ? materialized.name
        : instanceId

    return {
        ...materialized,
        type: 'card-instance',
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

export type ImportDocumentOptions = {
    defaultName?: string
}

// Import checks: normalize only document-level identity/version/size defaults.
export function prepareDocumentForImport(
    documentInput: unknown,
    options: ImportDocumentOptions = {}
): CardDocument {
    const source = toRecord(documentInput)
    const fallbackName = toNonEmptyString(options.defaultName) ?? 'OpenCard Document'
    const documentId = toNonEmptyString(source.id) ?? createBlockId('card-document')
    const width = toFiniteNumber(source.width) ?? 540
    const height = toFiniteNumber(source.height) ?? 850
    const name = toNonEmptyString(source.name) ?? fallbackName
    const version = toNonEmptyString(source.version) ?? '1.0.0'
    const background = toNonEmptyString(source.background) ?? '#FFFFFF'
    const children = Array.isArray(source.children)
        ? source.children as RootChild[]
        : []
    const instances = Array.isArray(source.instances)
        ? source.instances as CardInstanceRecord[]
        : []

    // Keep unknown top-level fields from imported document, only normalize required document keys.
    const normalizedDocument: Record<string, unknown> = {
        ...source,
        type: 'card-document',
        id: documentId,
        width,
        height,
        background,
        name,
        version,
        children,
        instances,
    }

    return normalizedDocument as CardDocument
}

// Render precheck: ensure renderer-facing structure is safe to traverse.
export function prepareDocumentForRender(documentInput: CardDocument): CardDocument {
    const source = toRecord(documentInput)
    const documentId = toNonEmptyString(source.id) ?? createBlockId('card-document')
    const width = toFiniteNumber(source.width) ?? 540
    const height = toFiniteNumber(source.height) ?? 850
    const name = typeof source.name === 'string' ? source.name : ''
    const version = toNonEmptyString(source.version) ?? '1.0.0'
    const background = toNonEmptyString(source.background) ?? '#FFFFFF'
    const children = toRecordArray(source.children).map((childInput) => ({
        block: toViewBlock(childInput.block),
        location: materializeSimpleContainerLocation(childInput.location),
    }))
    const instances = toRecordArray(source.instances).map((instanceInput) =>
        materializeCardInstanceRecord(instanceInput)
    )

    return {
        type: 'card-document',
        id: documentId,
        width,
        height,
        background,
        name,
        version,
        children,
        instances,
    }
}

export type PropertyEditorRecord = Record<string, unknown> & {
    type?: string
}

export type PropertyEditorInput = {
    key: string
    record: PropertyEditorRecord
    title?: string
    override?: PropertyEditorSchemaOverride
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
    setIfDefined(block, 'contentAnchor', init.contentAnchor)
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
const parentFieldReferencePattern = /^(p(?:\.p)*)\s*:\s*([^\s:][^:]*)$/
const documentFieldReferencePattern = /^d\s*:\s*([^\s:][^:]*)$/
const currentCardFieldReferencePattern = /^c\s*:\s*([^\s:][^:]*)$/
const templateTokenPattern = /\{\{\s*([^{}]+?)\s*\}\}/g
const singleTemplateTokenPattern = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/
const maxReferenceDepth = 24

// Default child placement for each container type.
function createDefaultSimpleContainerLocation(): SimpleContainerLocationInfo {
    return {
        id: createBlockId('simple-location'),
        type: 'simple-container-location',
        anchor: 'lt',
        x: 0,
        y: 0,
    }
}

function createDefaultFlowContainerLocation(container: FlowContainerBlock): FlowContainerLocationInfo {
    return {
        id: createBlockId('flow-location'),
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

type FieldReferenceDescriptor =
    | {
        kind: 'parent'
        parentDepth: number
        fieldKey: string
    }
    | {
        kind: 'document'
        fieldKey: string
    }
    | {
        kind: 'current-card'
        fieldKey: string
    }

function parseFieldReference(reference: string): FieldReferenceDescriptor | null {
    const normalized = reference.trim()
    const currentCardMatch = currentCardFieldReferencePattern.exec(normalized)
    if (currentCardMatch) {
        const fieldKey = currentCardMatch[1].trim()
        if (!fieldKey) {
            return null
        }
        return {
            kind: 'current-card',
            fieldKey,
        }
    }

    const documentMatch = documentFieldReferencePattern.exec(normalized)
    if (documentMatch) {
        const fieldKey = documentMatch[1].trim()
        if (!fieldKey) {
            return null
        }
        return {
            kind: 'document',
            fieldKey,
        }
    }

    const matched = parentFieldReferencePattern.exec(normalized)
    if (!matched) {
        return null
    }

    const parentChain = matched[1]
    const fieldKey = matched[2].trim()
    if (!fieldKey) {
        return null
    }

    const parentDepth = parentChain.split('.').length
    return {
        kind: 'parent',
        parentDepth,
        fieldKey,
    }
}

// Resolve `p...:field` and `d:field` references to a concrete `ownerId:field` key.
export function resolveParentFieldReferenceKey(
    blockId: string,
    reference: string,
    parentLookup: ParentLookup
): string | null {
    const descriptor = parseFieldReference(reference)
    if (!descriptor) {
        return null
    }

    if (descriptor.kind === 'current-card') {
        return null
    }

    if (descriptor.kind === 'document') {
        let currentBlockId = blockId
        while (true) {
            const parent = parentLookup.get(currentBlockId)
            if (!parent) {
                return null
            }
            if (parent.type === 'card-document') {
                return `${parent.id}:${descriptor.fieldKey}`
            }
            currentBlockId = parent.id
        }
    }

    let currentBlockId = blockId
    for (let depth = 0; depth < descriptor.parentDepth; depth += 1) {
        const parent = parentLookup.get(currentBlockId)
        if (!parent || parent.type === 'card-document') {
            return null
        }

        currentBlockId = parent.id
    }

    return `${currentBlockId}:${descriptor.fieldKey}`
}

export type ReferenceResolveIssueCode =
    | 'INVALID_TOKEN'
    | 'SOURCE_NOT_FOUND'
    | 'FIELD_NOT_ALLOWED'
    | 'FIELD_NOT_FOUND'
    | 'CYCLE'
    | 'MAX_DEPTH'
    | 'TYPE_MISMATCH'

export type ReferenceResolveIssue = {
    path: string
    token: string
    code: ReferenceResolveIssueCode
    reason: string
}

export type ResolveReferencesResult = {
    document: CardDocument
    issues: ReferenceResolveIssue[]
}

export type ResolveReferencesOptions = {
    currentCard?: CardInstanceRecord | null
}

type ReferenceOwnerKind = 'document' | 'block' | 'location' | 'current-card'
type ReferenceOwner = {
    kind: ReferenceOwnerKind
    key: string
    id: string
    typeName: string
    source: Record<string, unknown>
    target: Record<string, unknown>
    pathPrefix: string
    anchorBlockId: string | null
}

type ResolveFieldResult =
    | { ok: true, value: unknown }
    | { ok: false, value: unknown }

type ResolveMemoState = 'resolving' | 'done' | 'failed'

// Resolve field reference templates before materializing render defaults.
export function resolveReferences(document: CardDocument, options: ResolveReferencesOptions = {}): ResolveReferencesResult {
    const sourceDocument = document
    const cloneBlockTree = (block: CardBlock): CardBlock => {
        if (block.type === 'simple-container-block') {
            return {
                ...block,
                children: block.children.map((child) => ({
                    block: cloneBlockTree(child.block),
                    location: { ...child.location },
                })),
            }
        }

        if (block.type === 'flow-container-block') {
            return {
                ...block,
                children: block.children.map((child) => ({
                    block: cloneBlockTree(child.block),
                    location: { ...child.location },
                })),
            }
        }

        return { ...block }
    }

    const targetDocument: CardDocument = {
        ...document,
        children: document.children.map((child) => ({
            block: cloneBlockTree(child.block),
            location: { ...child.location },
        })),
        instances: document.instances?.map((instance) => ({
            ...instance,
            data: { ...instance.data },
        })),
    }
    const parentLookup = buildParentLookup(sourceDocument)
    const issues: ReferenceResolveIssue[] = []
    const valueMemo = new Map<string, unknown>()
    const stateMemo = new Map<string, ResolveMemoState>()
    const owners: ReferenceOwner[] = []
    const targetOwnersById = new Map<string, ReferenceOwner>()
    const documentOwner: ReferenceOwner = {
        kind: 'document',
        key: `doc:${sourceDocument.id}`,
        id: sourceDocument.id,
        typeName: sourceDocument.type,
        source: sourceDocument as unknown as Record<string, unknown>,
        target: targetDocument as unknown as Record<string, unknown>,
        pathPrefix: '$',
        anchorBlockId: null,
    }
    owners.push(documentOwner)
    targetOwnersById.set(documentOwner.id, documentOwner)

    const sourceCurrentCard = options.currentCard
        ? {
            ...options.currentCard,
            data: Object.fromEntries(
                Object.entries(options.currentCard.data ?? {}).map(([blockId, fieldMap]) => [blockId, { ...fieldMap }])
            ),
        } satisfies CardInstanceRecord
        : null

    const targetCurrentCard = sourceCurrentCard
        ? {
            ...sourceCurrentCard,
            data: Object.fromEntries(
                Object.entries(sourceCurrentCard.data ?? {}).map(([blockId, fieldMap]) => [blockId, { ...fieldMap }])
            ),
        } satisfies CardInstanceRecord
        : null

    const currentCardOwner: ReferenceOwner | null = sourceCurrentCard && targetCurrentCard
        ? {
            kind: 'current-card',
            key: `card:${sourceCurrentCard.id || '__current-card__'}`,
            id: sourceCurrentCard.id || '__current-card__',
            typeName: 'card-instance',
            source: sourceCurrentCard as unknown as Record<string, unknown>,
            target: targetCurrentCard as unknown as Record<string, unknown>,
            pathPrefix: '$.currentCard',
            anchorBlockId: null,
        }
        : null

    const visitChildren = (
        sourceChildren: Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
        targetChildren: Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
        parentPath: string
    ): void => {
        for (let index = 0; index < sourceChildren.length; index += 1) {
            const sourceChild = sourceChildren[index]
            const targetChild = targetChildren[index]
            if (!sourceChild || !targetChild) {
                continue
            }

            const childPath = `${parentPath}.children[${index}]`
            const sourceBlock = sourceChild.block
            const targetBlock = targetChild.block

            const blockOwner: ReferenceOwner = {
                kind: 'block',
                key: `block:${sourceBlock.id}`,
                id: sourceBlock.id,
                typeName: sourceBlock.type,
                source: sourceBlock as unknown as Record<string, unknown>,
                target: targetBlock as unknown as Record<string, unknown>,
                pathPrefix: `${childPath}.block`,
                anchorBlockId: sourceBlock.id,
            }
            owners.push(blockOwner)
            targetOwnersById.set(blockOwner.id, blockOwner)

            const sourceLocation = sourceChild.location as unknown as Record<string, unknown>
            const targetLocation = targetChild.location as unknown as Record<string, unknown>
            const locationType = typeof sourceLocation.type === 'string'
                ? sourceLocation.type
                : sourceChild.location.type
            owners.push({
                kind: 'location',
                key: `layout:${sourceBlock.id}`,
                id: sourceBlock.id,
                typeName: locationType,
                source: sourceLocation,
                target: targetLocation,
                pathPrefix: `${childPath}.location`,
                anchorBlockId: sourceBlock.id,
            })

            if (isBlockContainer(sourceBlock) && isBlockContainer(targetBlock)) {
                visitChildren(
                    sourceBlock.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
                    targetBlock.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
                    `${childPath}.block`
                )
            }
        }
    }

    visitChildren(
        sourceDocument.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
        targetDocument.children as Array<{ block: CardBlock, location: SimpleContainerLocationInfo | FlowContainerLocationInfo }>,
        '$'
    )

    function buildFieldPath(owner: ReferenceOwner, fieldKey: string): string {
        return `${owner.pathPrefix}.${fieldKey}`
    }

    function buildMemoKey(owner: ReferenceOwner, fieldKey: string): string {
        return `${owner.key}:${fieldKey}`
    }

    function pushIssue(
        path: string,
        token: string,
        code: ReferenceResolveIssueCode,
        reason: string
    ): void {
        issues.push({
            path,
            token,
            code,
            reason,
        })
    }

    function resolveTokenValue(
        owner: ReferenceOwner,
        tokenBody: string,
        fieldPath: string,
        recursionDepth: number
    ): ResolveFieldResult {
        if (recursionDepth > maxReferenceDepth) {
            pushIssue(fieldPath, `{{${tokenBody}}}`, 'MAX_DEPTH', `引用深度超过限制 ${maxReferenceDepth}`)
            return { ok: false, value: null }
        }

        const tokenDescriptor = parseFieldReference(tokenBody)
        if (!tokenDescriptor) {
            pushIssue(fieldPath, `{{${tokenBody}}}`, 'INVALID_TOKEN', '无效的引用语法')
            return { ok: false, value: null }
        }

        if (tokenDescriptor.kind === 'current-card') {
            const targetOwner = currentCardOwner ?? documentOwner
            const targetFieldKey = tokenDescriptor.fieldKey

            if (!isReferenceFieldReadable(targetOwner.typeName, targetFieldKey)) {
                pushIssue(
                    fieldPath,
                    `{{${tokenBody}}}`,
                    'FIELD_NOT_ALLOWED',
                    `字段 ${targetOwner.typeName}.${targetFieldKey} 不允许被引用`
                )
                return { ok: false, value: null }
            }

            if (!Object.prototype.hasOwnProperty.call(targetOwner.source, targetFieldKey)) {
                pushIssue(
                    fieldPath,
                    `{{${tokenBody}}}`,
                    'FIELD_NOT_FOUND',
                    `字段 ${targetOwner.typeName}.${targetFieldKey} 不存在`
                )
                return { ok: false, value: null }
            }

            const targetMemoKey = buildMemoKey(targetOwner, targetFieldKey)
            if (stateMemo.get(targetMemoKey) === 'resolving') {
                pushIssue(
                    fieldPath,
                    `{{${tokenBody}}}`,
                    'CYCLE',
                    `检测到循环引用 ${targetOwner.id}:${targetFieldKey}`
                )
                return { ok: false, value: null }
            }

            return resolveOwnerField(targetOwner, targetFieldKey, recursionDepth + 1)
        }

        let targetReference: string | null = null
        if (owner.anchorBlockId) {
            targetReference = resolveParentFieldReferenceKey(owner.anchorBlockId, tokenBody, parentLookup)
            if (!targetReference) {
                pushIssue(fieldPath, `{{${tokenBody}}}`, 'SOURCE_NOT_FOUND', '无法解析引用来源')
                return { ok: false, value: null }
            }
        } else if (tokenDescriptor.kind === 'document') {
            targetReference = `${documentOwner.id}:${tokenDescriptor.fieldKey}`
        } else {
            pushIssue(fieldPath, `{{${tokenBody}}}`, 'SOURCE_NOT_FOUND', '文档级字段不支持父链引用')
            return { ok: false, value: null }
        }

        const separatorIndex = targetReference.indexOf(':')
        if (separatorIndex < 1) {
            pushIssue(fieldPath, `{{${tokenBody}}}`, 'INVALID_TOKEN', '解析后的引用目标无效')
            return { ok: false, value: null }
        }

        const targetOwnerId = targetReference.slice(0, separatorIndex)
        const targetFieldKey = targetReference.slice(separatorIndex + 1)
        const targetOwner = targetOwnersById.get(targetOwnerId)
        if (!targetOwner) {
            pushIssue(fieldPath, `{{${tokenBody}}}`, 'SOURCE_NOT_FOUND', `未找到引用对象 ${targetOwnerId}`)
            return { ok: false, value: null }
        }

        if (!isReferenceFieldReadable(targetOwner.typeName, targetFieldKey)) {
            pushIssue(
                fieldPath,
                `{{${tokenBody}}}`,
                'FIELD_NOT_ALLOWED',
                `字段 ${targetOwner.typeName}.${targetFieldKey} 不允许被引用`
            )
            return { ok: false, value: null }
        }

        if (!Object.prototype.hasOwnProperty.call(targetOwner.source, targetFieldKey)) {
            pushIssue(
                fieldPath,
                `{{${tokenBody}}}`,
                'FIELD_NOT_FOUND',
                `字段 ${targetOwner.typeName}.${targetFieldKey} 不存在`
            )
            return { ok: false, value: null }
        }

        const targetMemoKey = buildMemoKey(targetOwner, targetFieldKey)
        if (stateMemo.get(targetMemoKey) === 'resolving') {
            pushIssue(
                fieldPath,
                `{{${tokenBody}}}`,
                'CYCLE',
                `检测到循环引用 ${targetOwner.id}:${targetFieldKey}`
            )
            return { ok: false, value: null }
        }

        return resolveOwnerField(targetOwner, targetFieldKey, recursionDepth + 1)
    }

    function resolveStringField(
        owner: ReferenceOwner,
        fieldKey: string,
        sourceValue: string,
        recursionDepth: number
    ): ResolveFieldResult {
        const fieldPath = buildFieldPath(owner, fieldKey)
        if (!sourceValue.includes('{{')) {
            return { ok: true, value: sourceValue }
        }

        const singleTokenMatch = singleTemplateTokenPattern.exec(sourceValue)
        if (singleTokenMatch) {
            const tokenBody = singleTokenMatch[1].trim()
            const tokenResult = resolveTokenValue(owner, tokenBody, fieldPath, recursionDepth + 1)
            if (!tokenResult.ok) {
                return { ok: false, value: sourceValue }
            }
            return tokenResult
        }

        let hasToken = false
        let resolvedValue = ''
        let cursor = 0
        templateTokenPattern.lastIndex = 0

        while (true) {
            const matched = templateTokenPattern.exec(sourceValue)
            if (!matched) {
                break
            }
            hasToken = true
            resolvedValue += sourceValue.slice(cursor, matched.index)

            const tokenBody = matched[1].trim()
            const tokenResult = resolveTokenValue(owner, tokenBody, fieldPath, recursionDepth + 1)
            if (!tokenResult.ok) {
                return { ok: false, value: sourceValue }
            }

            if (
                tokenResult.value !== null
                && tokenResult.value !== undefined
                && typeof tokenResult.value !== 'string'
                && typeof tokenResult.value !== 'number'
                && typeof tokenResult.value !== 'boolean'
                && typeof tokenResult.value !== 'bigint'
            ) {
                pushIssue(
                    fieldPath,
                    matched[0],
                    'TYPE_MISMATCH',
                    '内插值仅支持 string/number/boolean/bigint/null/undefined'
                )
                return { ok: false, value: sourceValue }
            }

            resolvedValue += tokenResult.value == null ? '' : String(tokenResult.value)
            cursor = matched.index + matched[0].length
        }

        if (!hasToken) {
            return { ok: true, value: sourceValue }
        }

        resolvedValue += sourceValue.slice(cursor)
        return { ok: true, value: resolvedValue }
    }

    function resolveOwnerField(
        owner: ReferenceOwner,
        fieldKey: string,
        recursionDepth: number
    ): ResolveFieldResult {
        const memoKey = buildMemoKey(owner, fieldKey)
        if (valueMemo.has(memoKey)) {
            return { ok: true, value: valueMemo.get(memoKey) }
        }

        if (stateMemo.get(memoKey) === 'failed') {
            return { ok: false, value: owner.source[fieldKey] }
        }

        if (recursionDepth > maxReferenceDepth) {
            pushIssue(
                buildFieldPath(owner, fieldKey),
                `${owner.id}:${fieldKey}`,
                'MAX_DEPTH',
                `引用深度超过限制 ${maxReferenceDepth}`
            )
            stateMemo.set(memoKey, 'failed')
            return { ok: false, value: owner.source[fieldKey] }
        }

        const sourceValue = owner.source[fieldKey]
        if (typeof sourceValue !== 'string') {
            const stableValue = owner.target[fieldKey]
            valueMemo.set(memoKey, stableValue)
            stateMemo.set(memoKey, 'done')
            return { ok: true, value: stableValue }
        }

        stateMemo.set(memoKey, 'resolving')
        const resolved = resolveStringField(owner, fieldKey, sourceValue, recursionDepth + 1)
        if (!resolved.ok) {
            stateMemo.set(memoKey, 'failed')
            return resolved
        }

        valueMemo.set(memoKey, resolved.value)
        stateMemo.set(memoKey, 'done')
        return resolved
    }

    for (const owner of owners) {
        const fieldKeys = Object.keys(owner.source)
        for (const fieldKey of fieldKeys) {
            const resolved = resolveOwnerField(owner, fieldKey, 0)
            owner.target[fieldKey] = resolved.value
        }
    }

    return {
        document: targetDocument,
        issues,
    }
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

export function getBlockTreeIcon(type: CardBlock['type']): IconToken {
    switch (type) {
        case 'text-block':
            return 'file.text'
        case 'image-block':
            return 'file.media'
        case 'simple-container-block':
            return 'data.collection'
        case 'flow-container-block':
            return 'data.layers'
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
    parent: TreeItem | null,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
): TreeItem => {
    const newNode: TreeItem = {
        name: block.name?.trim() || block.id,
        key: block.id,
        path: parent?.path ? [...parent.path, block.id] : [block.id],
        parent,
        isExpandable: isBlockContainer(block),
        icon: getBlockTreeIcon(block.type),
        actionKeys: isBlockContainer(block) ? ['add', 'duplicate', 'delete'] : ['duplicate', 'delete'],
        metadata: { block, location } satisfies CardTreeNodeMetadata,
    }

    if (isBlockContainer(block)) {
        newNode.children = block.children.map(child => blockToTreeNode(child.block, newNode, child.location))
    }

    return newNode
}

