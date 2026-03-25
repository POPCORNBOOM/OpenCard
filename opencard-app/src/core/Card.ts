import { ITreeNode } from "../components/ui/TreeNode.vue"

export type BaseBlock = {
    id: string
    anchor: AnchorPosition
    x?: CSSValue
    y?: CSSValue
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

export type TextBlock = BaseBlock & {
    type: "text"
    content: string
    mode: 'plain' | 'markdown' | 'richtext'
    fontSize?: CSSValue
    fontFamily?: string
    fontWeight?: 'normal' | 'bold' | number
    color?: string
    backgroundColor?: string
    textAlign?: 'left' | 'center' | 'right' | 'justify'
    lineHeight?: CSSValue
}

export type ImageBlock = BaseBlock & {
    type: "image"
    assetId: string
    fit: "cover" | "contain" | "fill"
}

export type SimpleContainerBlock = BaseBlock & {
    type: "simple-container"
    blocks: CardBlock[]
}

export type FlowContainerBlock = BaseBlock & {
    type: "flow-container"
    direction: 'lr' | 'rl' | 'tb' | 'bt'
    gap: CSSValue
    blocks: CardBlock[]
}

export type CardBlock = TextBlock | ImageBlock | SimpleContainerBlock | FlowContainerBlock

export type CardDocument = {
    name: string
    version: 1
    width: number
    height: number
    blocks: CardBlock[]
}


// 工具函数
export const block2ITreeNode = (block: CardBlock): ITreeNode => {
    if (block.type === 'flow-container' || block.type === 'simple-container') {
        return {
            name: block.id,
            key: `${block.type} (${block.id})`,
            isExpandable: true,
            children: block.blocks.map(block2ITreeNode),
            metadata: block
        }
    } else {
        return {
            name: block.id,
            key: `${block.type} (${block.id})`,
            isExpandable: false,
            metadata: block
        }
    }
}
