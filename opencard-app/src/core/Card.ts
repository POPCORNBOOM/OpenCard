import { ITreeNode } from "../components/ui/TreeNode.vue"

export type BaseBlock = {
    id: string
    width?: CSSValue // e.g. 100, "50%"
    height?: CSSValue
    translateX?: CSSValue
    translateY?: CSSValue
    scaleX?: number
    scaleY?: number
    transformAnchor?: AnchorPosition
    zIndex?: number
    rotation?: number
    opacity?: number
    customCss?: string // 有值时会覆盖以上布局相关属性
    metadata?: Record<string, unknown>
}

export type CSSValue = number | string

export type AnchorPosition =
    | 'lt' | 'ct' | 'rt'
    | 'lc' | 'cc' | 'rc'
    | 'lb' | 'cb' | 'rb'

export type AlignmentPosition = 'start' | 'center' | 'end' | 'justify'

export type TextBlock = BaseBlock & {
    type: "text"
    content: string
    mode: 'plain' | 'markdown' | 'richtext'
    fontSize?: CSSValue
    fontFamily?: string
    fontWeight?: 'normal' | 'bold' | number
    color?: string
    backgroundColor?: string
    textAlign?: AlignmentPosition
    lineHeight?: CSSValue
}

export type ImageBlock = BaseBlock & {
    type: "image"
    assetId: string
    fit: "cover" | "contain" | "fill"
}

export type SimpleContainerLocationInfo = {
    anchor: AnchorPosition
    x?: CSSValue
    y?: CSSValue

}

export type SimpleContainerBlock = BaseBlock & {
    type: "simple-container"
    children: {
        block: CardBlock,
        location: SimpleContainerLocationInfo
    }[]
}

export type FlowContainerLocationInfo = {
    index: number // 在 flow 容器中的位置索引，从 0 开始
    align?: AlignmentPosition // 沿交叉轴的对齐方式，默认为 'start'
}

export type FlowDirection = 'lr' | 'rl' | 'tb' | 'bt'

export type FlowContainerBlock = BaseBlock & {
    type: "flow-container"
    direction: FlowDirection
    gap: CSSValue
    children: {
        block: CardBlock,
        location: FlowContainerLocationInfo
    }[]
}

export type CardBlock = TextBlock | ImageBlock | SimpleContainerBlock | FlowContainerBlock

export type RootChild = {
    block: CardBlock
    location: SimpleContainerLocationInfo
}

export type CardDocument = {
    name: string
    version: 1
    width: number
    height: number
    children: RootChild[]
}

export type PropertyEditorTarget = Record<string, unknown> & {
    type?: string
}

type BlockInit = Pick<BaseBlock, 'id'> & Partial<Omit<BaseBlock, 'id'>>
type TextBlockInit = Partial<Omit<TextBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type ImageBlockInit = Partial<Omit<ImageBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type SimpleContainerBlockInit = Partial<Omit<SimpleContainerBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>
type FlowContainerBlockInit = Partial<Omit<FlowContainerBlock, keyof BaseBlock | 'type'>> & Partial<BaseBlock>

let blockIdCounter = 0

function createBlockId(prefix = 'block'): string {
    blockIdCounter += 1
    return `${prefix}-${Date.now()}-${blockIdCounter}`
}

function createBaseBlock(init: BlockInit = { id: createBlockId() }): BaseBlock {
    return {
        id: init.id ?? createBlockId(),
        width: init.width,
        height: init.height,
        translateX: init.translateX,
        translateY: init.translateY,
        scaleX: init.scaleX,
        scaleY: init.scaleY,
        transformAnchor: init.transformAnchor,
        zIndex: init.zIndex,
        rotation: init.rotation,
        opacity: init.opacity,
        customCss: init.customCss,
        metadata: init.metadata,
    }
}

export function createTextBlock(init: TextBlockInit = {}): TextBlock {
    return {
        ...createBaseBlock({ id: init.id ?? createBlockId('text'), ...init }),
        type: 'text',
        content: init.content ?? '',
        mode: init.mode ?? 'plain',
        fontSize: init.fontSize,
        fontFamily: init.fontFamily,
        fontWeight: init.fontWeight,
        color: init.color,
        backgroundColor: init.backgroundColor,
        textAlign: init.textAlign,
        lineHeight: init.lineHeight,
    }
}

export function createImageBlock(init: ImageBlockInit = {}): ImageBlock {
    return {
        ...createBaseBlock({ id: init.id ?? createBlockId('image'), ...init }),
        type: 'image',
        assetId: init.assetId ?? '',
        fit: init.fit ?? 'cover',
    }
}

export function createSimpleContainerBlock(init: SimpleContainerBlockInit = {}): SimpleContainerBlock {
    return {
        ...createBaseBlock({ id: init.id ?? createBlockId('simple-container'), ...init }),
        type: 'simple-container',
        children: init.children ? [...init.children] : [],
    }
}

export function createFlowContainerBlock(init: FlowContainerBlockInit = {}): FlowContainerBlock {
    return {
        ...createBaseBlock({ id: init.id ?? createBlockId('flow-container'), ...init }),
        type: 'flow-container',
        direction: init.direction ?? 'lr',
        gap: init.gap ?? '10px',
        children: init.children ? [...init.children] : [],
    }
}

export function createBlock(type: 'text', init?: TextBlockInit): TextBlock
export function createBlock(type: 'image', init?: ImageBlockInit): ImageBlock
export function createBlock(type: 'simple-container', init?: SimpleContainerBlockInit): SimpleContainerBlock
export function createBlock(type: 'flow-container', init?: FlowContainerBlockInit): FlowContainerBlock
export function createBlock(type: CardBlock['type'], init: unknown = {}): CardBlock {
    switch (type) {
        case 'text':
            return createTextBlock(init as TextBlockInit)
        case 'image':
            return createImageBlock(init as ImageBlockInit)
        case 'simple-container':
            return createSimpleContainerBlock(init as SimpleContainerBlockInit)
        case 'flow-container':
            return createFlowContainerBlock(init as FlowContainerBlockInit)
    }
}

export type ContainerBlock = SimpleContainerBlock | FlowContainerBlock

export function addContainerChild<T extends ContainerBlock>(
    container: T,
    childBlock: CardBlock,
    location: T extends SimpleContainerBlock ? SimpleContainerLocationInfo : FlowContainerLocationInfo
): void {
    container.children.push({ block: childBlock, location: location as any })
}

export function removeContainerChild<T extends ContainerBlock>(
    container: T,
    childBlock: CardBlock
): void {
    const index = container.children.findIndex(child => child.block.id === childBlock.id)
    if (index !== -1) {
        container.children.splice(index, 1)
    }
}

type EditorPropertyBase = {
    isHiddenForEditor?: boolean
    isArray?: boolean
    isReadonlyForEditor?: boolean
    label?: string
    category?: string
}

export type PropertyConstraintMap = {
    string: {
        minLength?: number
        maxLength?: number
        options?: readonly string[]
    }
    number: {
        min?: number
        max?: number
    }
    boolean: {}
    color: {
        enablePicker?: boolean
        enableCss?: boolean
    }
    object: {
        objectType: string
    }
}

export function isContainerBlock(block: CardBlock): block is ContainerBlock {
    return block.type === 'simple-container' || block.type === 'flow-container'
}

export type PropertyDatatype = keyof PropertyConstraintMap

type AllConstraintKeys = {
    [K in keyof PropertyConstraintMap]: keyof PropertyConstraintMap[K]
}[keyof PropertyConstraintMap]

type StrictVariant<
    T extends keyof PropertyConstraintMap
> = EditorPropertyBase & {
    datatype: T
} & PropertyConstraintMap[T] & {
        [K in Exclude<AllConstraintKeys, keyof PropertyConstraintMap[T]>]?: never
    }

export type EditorPropertyDefinition = {
    [K in keyof PropertyConstraintMap]: StrictVariant<K>
}[keyof PropertyConstraintMap]


export type TypePropertyDefinitions = Record<string, Record<string, EditorPropertyDefinition>>
export type BlockPropertyDefinitions = Record<CardBlock['type'], Record<string, EditorPropertyDefinition>>
export type PropertyEditorSource = {
    title: string
    target: PropertyEditorTarget
    definitions?: Record<string, EditorPropertyDefinition>
    typeDefinitions?: TypePropertyDefinitions
}
export type PropertyEditorEntry = {
    key: string
    label?: string
    category?: string
    sourceCategoryTitle?: string
    value: unknown
    target: Record<string, unknown>
    definition: EditorPropertyDefinition
}
export type PropertyEditorCategory = {
    title: string
    entries: PropertyEditorEntry[]
}
export type CardTreeNodeMetadata = {
    block: CardBlock
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
}

const anchorOptions = ['lt', 'ct', 'rt', 'lc', 'cc', 'rc', 'lb', 'cb', 'rb'] as const
const flowDirectionOptions = ['lr', 'rl', 'tb', 'bt'] as const
const textModeOptions = ['plain', 'markdown', 'richtext'] as const
const imageFitOptions = ['cover', 'contain', 'fill'] as const
const textAlignOptions = ['left', 'center', 'right', 'justify'] as const

export const blockPropertyDefinitions: BlockPropertyDefinitions = {
    text: {
        id: { datatype: 'string', minLength: 1, label: 'ID', category: 'Identity' },
        type: { datatype: 'string', isReadonlyForEditor: true, label: 'Type', category: 'Identity' },
        width: { datatype: 'string', label: 'Width', category: 'Layout' },
        height: { datatype: 'string', label: 'Height', category: 'Layout' },
        translateX: { datatype: 'string', label: 'Translate X', category: 'Transform' },
        translateY: { datatype: 'string', label: 'Translate Y', category: 'Transform' },
        scaleX: { datatype: 'number', label: 'Scale X', category: 'Transform' },
        scaleY: { datatype: 'number', label: 'Scale Y', category: 'Transform' },
        transformAnchor: { datatype: 'string', options: anchorOptions, label: 'Transform Anchor', category: 'Transform' },
        zIndex: { datatype: 'number', label: 'Z-Index', category: 'Layout' },
        rotation: { datatype: 'number', label: 'Rotation', category: 'Transform' },
        opacity: { datatype: 'number', min: 0, max: 1, label: 'Opacity', category: 'Appearance' },
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHiddenForEditor: true, label: 'Metadata', category: 'Data' },
        content: { datatype: 'string', label: 'Content', category: 'Content' },
        mode: { datatype: 'string', options: textModeOptions, label: 'Mode', category: 'Content' },
        fontSize: { datatype: 'string', label: 'Font Size', category: 'Typography' },
        fontFamily: { datatype: 'string', label: 'Font Family', category: 'Typography' },
        fontWeight: { datatype: 'string', label: 'Font Weight', category: 'Typography' },
        color: { datatype: 'color', enablePicker: true, enableCss: true, label: 'Text Color', category: 'Appearance' },
        backgroundColor: { datatype: 'color', enablePicker: true, enableCss: true, label: 'Background Color', category: 'Appearance' },
        textAlign: { datatype: 'string', options: textAlignOptions, label: 'Text Align', category: 'Typography' },
        lineHeight: { datatype: 'string', label: 'Line Height', category: 'Typography' },
    },
    image: {
        id: { datatype: 'string', minLength: 1, label: 'ID', category: 'Identity' },
        type: { datatype: 'string', isReadonlyForEditor: true, label: 'Type', category: 'Identity' },
        width: { datatype: 'string', label: 'Width', category: 'Layout' },
        height: { datatype: 'string', label: 'Height', category: 'Layout' },
        translateX: { datatype: 'string', label: 'Translate X', category: 'Transform' },
        translateY: { datatype: 'string', label: 'Translate Y', category: 'Transform' },
        scaleX: { datatype: 'number', label: 'Scale X', category: 'Transform' },
        scaleY: { datatype: 'number', label: 'Scale Y', category: 'Transform' },
        transformAnchor: { datatype: 'string', options: anchorOptions, label: 'Transform Anchor', category: 'Transform' },
        zIndex: { datatype: 'number', label: 'Z-Index', category: 'Layout' },
        rotation: { datatype: 'number', label: 'Rotation', category: 'Transform' },
        opacity: { datatype: 'number', min: 0, max: 1, label: 'Opacity', category: 'Appearance' },
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHiddenForEditor: true, label: 'Metadata', category: 'Data' },
        assetId: { datatype: 'string', minLength: 1, label: 'Asset ID', category: 'Content' },
        fit: { datatype: 'string', options: imageFitOptions, label: 'Fit', category: 'Appearance' },
    },
    'simple-container': {
        id: { datatype: 'string', minLength: 1, label: 'ID', category: 'Identity' },
        type: { datatype: 'string', isReadonlyForEditor: true, label: 'Type', category: 'Identity' },
        width: { datatype: 'string', label: 'Width', category: 'Layout' },
        height: { datatype: 'string', label: 'Height', category: 'Layout' },
        translateX: { datatype: 'string', label: 'Translate X', category: 'Transform' },
        translateY: { datatype: 'string', label: 'Translate Y', category: 'Transform' },
        scaleX: { datatype: 'number', label: 'Scale X', category: 'Transform' },
        scaleY: { datatype: 'number', label: 'Scale Y', category: 'Transform' },
        transformAnchor: { datatype: 'string', options: anchorOptions, label: 'Transform Anchor', category: 'Transform' },
        zIndex: { datatype: 'number', label: 'Z-Index', category: 'Layout' },
        rotation: { datatype: 'number', label: 'Rotation', category: 'Transform' },
        opacity: { datatype: 'number', min: 0, max: 1, label: 'Opacity', category: 'Appearance' },
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHiddenForEditor: true, label: 'Metadata', category: 'Data' },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHiddenForEditor: true, label: 'Children', category: 'Data' },
    },
    'flow-container': {
        id: { datatype: 'string', minLength: 1, label: 'ID', category: 'Identity' },
        type: { datatype: 'string', isReadonlyForEditor: true, label: 'Type', category: 'Identity' },
        anchor: { datatype: 'string', options: anchorOptions, label: 'Anchor', category: 'Layout' },
        width: { datatype: 'string', label: 'Width', category: 'Layout' },
        height: { datatype: 'string', label: 'Height', category: 'Layout' },
        translateX: { datatype: 'string', label: 'Translate X', category: 'Transform' },
        translateY: { datatype: 'string', label: 'Translate Y', category: 'Transform' },
        scaleX: { datatype: 'number', label: 'Scale X', category: 'Transform' },
        scaleY: { datatype: 'number', label: 'Scale Y', category: 'Transform' },
        transformAnchor: { datatype: 'string', options: anchorOptions, label: 'Transform Anchor', category: 'Transform' },
        zIndex: { datatype: 'number', label: 'Z-Index', category: 'Layout' },
        rotation: { datatype: 'number', label: 'Rotation', category: 'Transform' },
        opacity: { datatype: 'number', min: 0, max: 1, label: 'Opacity', category: 'Appearance' },
        customCss: { datatype: 'string', label: 'Custom CSS', category: 'Appearance' },
        metadata: { datatype: 'object', objectType: 'metadata', isHiddenForEditor: true, label: 'Metadata', category: 'Data' },
        direction: { datatype: 'string', options: flowDirectionOptions, label: 'Direction', category: 'Layout' },
        gap: { datatype: 'string', label: 'Gap', category: 'Layout' },
        children: { datatype: 'object', objectType: 'CardBlock', isArray: true, isHiddenForEditor: true, label: 'Children', category: 'Data' },
    },
}

export const simpleContainerChildLocationDefinitions: Record<string, EditorPropertyDefinition> = {
    anchor: { datatype: 'string', options: anchorOptions, label: 'Anchor', category: 'Position' },
    x: { datatype: 'string', label: 'X', category: 'Position' },
    y: { datatype: 'string', label: 'Y', category: 'Position' },
}

export const rootChildLocationDefinitions = simpleContainerChildLocationDefinitions

export const flowContainerChildLocationDefinitions: Record<string, EditorPropertyDefinition> = {
    index: { datatype: 'number', min: 0, label: 'Index', category: 'Flow' },
    align: { datatype: 'string', options: ['start', 'center', 'end', 'justify'] as const, label: 'Align', category: 'Flow' },
}

export function getTypePropertyDefinitions(
    typeName: string | undefined,
    definitions: TypePropertyDefinitions
): Record<string, EditorPropertyDefinition> {
    if (!typeName) {
        return {}
    }
    return definitions[typeName] ?? {}
}


// 工具函数
export const block2ITreeNode = (
    block: CardBlock,
    parent: ITreeNode | null,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
): ITreeNode => {
    const newNode: ITreeNode = {
        name: block.id,
        key: `${block.type} (${block.id})`,
        path: parent?.path ? [...parent.path, block.id] : [block.id],
        parent: parent,
        actionKeys: ['add'],
        metadata: { block, location } satisfies CardTreeNodeMetadata
    }
    if (block.type === 'flow-container' || block.type === 'simple-container') {
        newNode.children = block.children.map(child => block2ITreeNode(child.block, newNode, child.location))
    }
    return newNode
}
