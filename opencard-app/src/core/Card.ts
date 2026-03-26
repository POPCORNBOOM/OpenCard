import { ITreeNode } from "../components/ui/TreeNode.vue"

export type BaseBlock = {
    id: string
    width?: CSSValue
    height?: CSSValue
    translateX?: CSSValue
    translateY?: CSSValue
    scaleX?: number
    scaleY?: number
    transformAnchor?: AnchorPosition
    zIndex?: number
    rotation?: number
    opacity?: number
    customCss?: string
    metadata?: Record<string, unknown>
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
    backgroundColor?: string
    textAlign?: AlignmentPosition
    lineHeight?: CSSValue
}

export type ImageBlock = BaseBlock & {
    type: "image-block"
    assetId: string
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
    name: string
    version: 1
    width: number
    height: number
    children: RootChild[]
}

export type PropertyEditorTarget = Record<string, unknown> & {
    type?: string
}

export type PropertyEditorSource = {
    title: string
    target: PropertyEditorTarget
}

export type CardTreeNodeMetadata = {
    block: CardBlock
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
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
        ...createBaseBlock({ id: init.id ?? createBlockId('text-block'), ...init }),
        type: 'text-block',
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
        ...createBaseBlock({ id: init.id ?? createBlockId('image-block'), ...init }),
        type: 'image-block',
        assetId: init.assetId ?? '',
        fit: init.fit ?? 'cover',
    }
}

export function createSimpleContainerBlock(init: SimpleContainerBlockInit = {}): SimpleContainerBlock {
    return {
        ...createBaseBlock({ id: init.id ?? createBlockId('simple-container-block'), ...init }),
        type: 'simple-container-block',
        children: init.children ? [...init.children] : [],
    }
}

export function createFlowContainerBlock(init: FlowContainerBlockInit = {}): FlowContainerBlock {
    return {
        ...createBaseBlock({ id: init.id ?? createBlockId('flow-container-block'), ...init }),
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

export type ContainerBlock = SimpleContainerBlock | FlowContainerBlock

export function addContainerChild(
    container: SimpleContainerBlock,
    childBlock: CardBlock,
    location: SimpleContainerLocationInfo
): void
export function addContainerChild(
    container: FlowContainerBlock,
    childBlock: CardBlock,
    location: FlowContainerLocationInfo
): void
export function addContainerChild(
    container: ContainerBlock,
    childBlock: CardBlock,
    location: SimpleContainerLocationInfo | FlowContainerLocationInfo
): void {
    if (container.type === 'simple-container-block' && location.type === 'simple-container-location') {
        container.children.push({ block: childBlock, location })
        return
    }

    if (container.type === 'flow-container-block' && location.type === 'flow-container-location') {
        container.children.push({ block: childBlock, location })
    }
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

export function isContainerBlock(block: CardBlock): block is ContainerBlock {
    return block.type === 'simple-container-block' || block.type === 'flow-container-block'
}

export const block2ITreeNode = (
    block: CardBlock,
    parent: ITreeNode | null,
    location?: SimpleContainerLocationInfo | FlowContainerLocationInfo
): ITreeNode => {
    const newNode: ITreeNode = {
        name: block.id,
        key: `${block.type} (${block.id})`,
        path: parent?.path ? [...parent.path, block.id] : [block.id],
        parent,
        actionKeys: ['add'],
        metadata: { block, location } satisfies CardTreeNodeMetadata,
    }

    if (block.type === 'flow-container-block' || block.type === 'simple-container-block') {
        newNode.children = block.children.map(child => block2ITreeNode(child.block, newNode, child.location))
    }

    return newNode
}
