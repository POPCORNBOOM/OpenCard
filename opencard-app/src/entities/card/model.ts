/**
 * 模块说明：
 * - 定义卡牌领域模型、字段能力与对象创建
 * 职责边界：
 * - 维护领域结构真相 不包含组件渲染实现
 */
import {
    acceptsPropertyBinding,
    additionalFieldTypes,
    createPropertyDefaultValue,
    exposesPropertyReference,
    getPropertyValueKind,
    getTypePropertyEditorSchema,
} from './schema'
import type { EditorPropertyDefinition, PropertyFieldType } from './schema'
import type { BindingValueKind } from '../../features/editor-runtime/model/binding'

export type AdditionalFieldDefinition = {
    title?: string
    fieldType: PropertyFieldType
}
export type AdditionalFieldDefinitionMap = Record<string, AdditionalFieldDefinition>

// Block and document data models.
export type BaseBlock = {
    id: string
    name?: string
    width?: CSSValue
    height?: CSSValue
    borderColor?: string
    borderWidth?: string
    borderStyle?: 'solid' | 'dashed' | 'dotted'
    borderRadius?: CSSValue
    background?: string
    translateX?: CSSValue
    translateY?: CSSValue
    scaleX?: string
    scaleY?: string
    transformAnchor?: AnchorPosition
    zIndex?: string
    rotation?: string
    opacity?: string
    customCss?: string
    additionalFieldDefinition?: AdditionalFieldDefinitionMap
}

export type CSSValue = string

export type AnchorPosition =
    | 'lt' | 'ct' | 'rt'
    | 'lc' | 'cc' | 'rc'
    | 'lb' | 'cb' | 'rb'

export type AlignmentPosition = 'start' | 'center' | 'end' | 'justify'
export type VerticalAlignmentPosition = 'top' | 'center' | 'bottom'
export type TextWritingMode = 'horizontal-tb' | 'vertical-rl' | 'vertical-lr'

export type TextBlock = BaseBlock & {
    type: "text-block"
    content: string
    mode: 'plain' | 'markdown' | 'richtext'
    fontSize?: CSSValue
    fontFamily?: string
    fontWeight?: string
    color?: string
    textAlign?: AlignmentPosition
    verticalAlign?: VerticalAlignmentPosition
    lineHeight?: CSSValue
    writingMode?: TextWritingMode
}

export type ImageBlock = BaseBlock & {
    type: "image-block"
    image: string
    imagePath?: string
    fit: "cover" | "contain" | "fill"
}

export type QRCodeBlock = BaseBlock & {
    type: "qrcode-block"
    content: string
    errorCorrection: "L" | "M" | "Q" | "H"
    foreground: string
    backgroundColor: string
    quietZone: string
}

export type ShapeBlock = BaseBlock & {
    type: "shape-block"
    shape: "rectangle" | "ellipse" | "line" | "triangle" | "diamond"
    fill: string
    stroke: string
    strokeWidth: string
    strokeStyle: "solid" | "dashed" | "dotted"
    strokeAlignment: "inside" | "center" | "outside"
    strokeJoin: "miter" | "round" | "bevel"
    strokeCap: "butt" | "round" | "square"
    strokeMiterLimit: string
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
    index: string
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

export type CardBlock = TextBlock | ImageBlock | QRCodeBlock | ShapeBlock | SimpleContainerBlock | FlowContainerBlock

export type RootChild = {
    block: CardBlock
    location: SimpleContainerLocationInfo
}

export type CardDocument = {
    type: "card-document"
    name: string
    id: string
    version: string
    width: string
    height: string
    background: string
    children: RootChild[]
    instances: CardInstanceRecord[]
}

export type CardInstanceRecord = {
    type: 'card-instance'
    id: string
    name: string
    amount: string
    data: Record<string, Record<string, CardStoredValue>>
}

export type CardStoredValue = string | CardStoredValue[] | { [key: string]: CardStoredValue }

export function isCardStoredValue(value: unknown): value is CardStoredValue {
    if (typeof value === 'string') return true
    if (Array.isArray(value)) return value.every(item => isCardStoredValue(item))
    if (!value || typeof value !== 'object') return false
    return Object.values(value).every(item => isCardStoredValue(item))
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

const additionalFieldTypeSet = new Set<PropertyFieldType>(additionalFieldTypes)

function materializeAdditionalFieldDefinitions(value: unknown): AdditionalFieldDefinitionMap {
    const source = toRecord(value)
    const fields: AdditionalFieldDefinitionMap = {}

    for (const [fieldKey, fieldValue] of Object.entries(source)) {
        const definition = toRecord(fieldValue)
        const fieldType = definition.fieldType
        if (typeof fieldType !== 'string' || !additionalFieldTypeSet.has(fieldType as PropertyFieldType)) {
            continue
        }

        const title = typeof definition.title === 'string' ? definition.title.trim() : ''
        fields[fieldKey] = {
            fieldType: fieldType as PropertyFieldType,
            ...(title ? { title } : {}),
        }
    }

    return fields
}

function cloneAdditionalFieldDefinitions(
    fields: AdditionalFieldDefinitionMap | undefined,
): AdditionalFieldDefinitionMap | undefined {
    if (!fields) return undefined
    return Object.fromEntries(
        Object.entries(fields).map(([fieldKey, definition]) => [fieldKey, { ...definition }]),
    )
}

export function getAdditionalFieldPropertyDefinition(
    definition: AdditionalFieldDefinition,
): EditorPropertyDefinition {
    return {
        fieldType: definition.fieldType,
    } as EditorPropertyDefinition
}

export function getCardFieldDefinition(
    record: Record<string, unknown>,
    fieldKey: string,
): EditorPropertyDefinition | undefined {
    const typeName = typeof record.type === 'string' ? record.type : undefined
    const nativeDefinition = getTypePropertyEditorSchema(typeName)[fieldKey]
    if (nativeDefinition) return nativeDefinition
    const additionalField = materializeAdditionalFieldDefinitions(record.additionalFieldDefinition)[fieldKey]
    return additionalField ? getAdditionalFieldPropertyDefinition(additionalField) : undefined
}

export function getCardFieldKeys(record: Record<string, unknown>): string[] {
    return [...new Set([
        ...Object.keys(record).filter((fieldKey) => fieldKey !== 'additionalFieldDefinition'),
    ])]
}

export function hasCardField(record: Record<string, unknown>, fieldKey: string): boolean {
    return Object.prototype.hasOwnProperty.call(record, fieldKey)
}

export function getCardFieldValue(record: Record<string, unknown>, fieldKey: string): unknown {
    return record[fieldKey]
}

export function setCardFieldValue(
    record: Record<string, unknown>,
    fieldKey: string,
    value: unknown,
): boolean {
    if (Object.prototype.hasOwnProperty.call(record, fieldKey)
        || materializeAdditionalFieldDefinitions(record.additionalFieldDefinition)[fieldKey]) {
        record[fieldKey] = value
        return true
    }
    return false
}

export function getCardFieldValueKind(
    record: Record<string, unknown>,
    fieldKey: string,
): BindingValueKind {
    return getPropertyValueKind(getCardFieldDefinition(record, fieldKey))
}

export function acceptsCardFieldBinding(record: Record<string, unknown>, fieldKey: string): boolean {
    return acceptsPropertyBinding(getCardFieldDefinition(record, fieldKey))
}

export function exposesCardFieldReference(record: Record<string, unknown>, fieldKey: string): boolean {
    return exposesPropertyReference(getCardFieldDefinition(record, fieldKey))
}

export type AdditionalFieldKeyError = 'required' | 'invalid' | 'duplicate' | 'unsupported-field-type'
export const additionalFieldKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/

export function validateAdditionalFieldKey(block: CardBlock, candidate: string): AdditionalFieldKeyError | null {
    const fieldKey = candidate.trim()
    if (!fieldKey) return 'required'
    if (!additionalFieldKeyPattern.test(fieldKey)) return 'invalid'

    const identity = fieldKey.toLocaleLowerCase()
    const occupiedKeys = new Set([
        ...Object.keys(getTypePropertyEditorSchema(block.type)),
        ...Object.keys(block).filter((key) => key !== 'additionalFieldDefinition'),
        ...Object.keys(block.additionalFieldDefinition ?? {}),
    ].map((key) => key.toLocaleLowerCase()))
    return occupiedKeys.has(identity) ? 'duplicate' : null
}

export function createBlockAdditionalField(
    block: CardBlock,
    fieldKeyInput: string,
    fieldType: PropertyFieldType,
    titleInput?: string,
): AdditionalFieldKeyError | null {
    if (!additionalFieldTypeSet.has(fieldType)) return 'unsupported-field-type'
    const error = validateAdditionalFieldKey(block, fieldKeyInput)
    if (error) return error

    const fieldKey = fieldKeyInput.trim()
    const title = titleInput?.trim() ?? ''
    const definitions = block.additionalFieldDefinition ?? (block.additionalFieldDefinition = {})
    definitions[fieldKey] = {
        fieldType,
        ...(title ? { title } : {}),
    }
    ;(block as unknown as Record<string, unknown>)[fieldKey] = createPropertyDefaultValue({ fieldType } as EditorPropertyDefinition)
    return null
}

export function deleteBlockAdditionalField(
    document: CardDocument,
    block: CardBlock,
    fieldKey: string,
): number {
    if (!block.additionalFieldDefinition?.[fieldKey]) return 0
    delete (block as unknown as Record<string, unknown>)[fieldKey]
    delete block.additionalFieldDefinition[fieldKey]
    if (Object.keys(block.additionalFieldDefinition).length === 0) delete block.additionalFieldDefinition

    let removedOverrides = 0
    for (const instance of document.instances ?? []) {
        const instanceBlockData = instance.data[block.id]
        if (!instanceBlockData || !Object.prototype.hasOwnProperty.call(instanceBlockData, fieldKey)) continue
        delete instanceBlockData[fieldKey]
        removedOverrides += 1
        if (Object.keys(instanceBlockData).length === 0) delete instance.data[block.id]
    }
    return removedOverrides
}

// Internal helper types for block factory functions.
type BlockInit = Pick<BaseBlock, 'id'> & Partial<Omit<BaseBlock, 'id'>>
type TextBlockInit = Partial<Omit<TextBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type ImageBlockInit = Partial<Omit<ImageBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type QRCodeBlockInit = Partial<Omit<QRCodeBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type ShapeBlockInit = Partial<Omit<ShapeBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
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
    setIfDefined(block, 'borderColor', init.borderColor)
    setIfDefined(block, 'borderWidth', init.borderWidth)
    setIfDefined(block, 'borderStyle', init.borderStyle)
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
    setIfDefined(block, 'additionalFieldDefinition', cloneAdditionalFieldDefinitions(init.additionalFieldDefinition))

    return block as BaseBlock
}

function getDefaultBlockName(type: CardBlock['type']): string {
    switch (type) {
        case 'text-block':
            return 'Text Block'
        case 'image-block':
            return 'Image Block'
        case 'qrcode-block':
            return 'QR Code'
        case 'shape-block':
            return 'Shape'
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
    setIfDefined(block, 'verticalAlign', init.verticalAlign)
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

export function createQRCodeBlock(init: QRCodeBlockInit = {}): QRCodeBlock {
    return {
        ...createBaseBlock({
            id: init.id ?? createBlockId('qrcode-block'),
            name: init.name ?? getDefaultBlockName('qrcode-block'),
            ...init,
        }),
        type: 'qrcode-block',
        content: init.content ?? '',
        errorCorrection: init.errorCorrection ?? 'M',
        foreground: init.foreground ?? '#000000',
        backgroundColor: init.backgroundColor ?? '#FFFFFF',
        quietZone: init.quietZone ?? '4',
    }
}

export function createShapeBlock(init: ShapeBlockInit = {}): ShapeBlock {
    return {
        ...createBaseBlock({
            id: init.id ?? createBlockId('shape-block'),
            name: init.name ?? getDefaultBlockName('shape-block'),
            ...init,
        }),
        type: 'shape-block',
        shape: init.shape ?? 'rectangle',
        fill: init.fill ?? '#7C6CFF',
        stroke: init.stroke ?? '#000000',
        strokeWidth: init.strokeWidth ?? '0',
        strokeStyle: init.strokeStyle ?? 'solid',
        strokeAlignment: init.strokeAlignment ?? 'center',
        strokeJoin: init.strokeJoin ?? 'miter',
        strokeCap: init.strokeCap ?? 'butt',
        strokeMiterLimit: init.strokeMiterLimit ?? '4',
    }
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
export function createBlock(type: 'qrcode-block', init?: QRCodeBlockInit): QRCodeBlock
export function createBlock(type: 'shape-block', init?: ShapeBlockInit): ShapeBlock
export function createBlock(type: 'simple-container-block', init?: SimpleContainerBlockInit): SimpleContainerBlock
export function createBlock(type: 'flow-container-block', init?: FlowContainerBlockInit): FlowContainerBlock
export function createBlock(type: CardBlock['type'], init: unknown = {}): CardBlock {
    switch (type) {
        case 'text-block':
            return createTextBlock(init as TextBlockInit)
        case 'image-block':
            return createImageBlock(init as ImageBlockInit)
        case 'qrcode-block':
            return createQRCodeBlock(init as QRCodeBlockInit)
        case 'shape-block':
            return createShapeBlock(init as ShapeBlockInit)
        case 'simple-container-block':
            return createSimpleContainerBlock(init as SimpleContainerBlockInit)
        case 'flow-container-block':
            return createFlowContainerBlock(init as FlowContainerBlockInit)
    }
}

export function isCardBlock(target: any): target is CardBlock {
    //检查对象的type属性是否以-block结尾，以区分是否为CardBlock类型
    return target && typeof target === 'object' && typeof target.type === 'string' && target.type.endsWith('-block')
}
