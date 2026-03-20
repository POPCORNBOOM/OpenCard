export type BaseComponent = {
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

export type TextComponent = BaseComponent & {
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

export type ImageComponent = BaseComponent & {
    type: "image"
    assetId: string
    fit: "cover" | "contain" | "fill"
}

export type SimpleContainerComponent = BaseComponent & {
    type: "simple-container"
    components: Component[]
}

export type FlowContainerComponent = BaseComponent & {
    type: "flow-container"
    direction: 'lr' | 'rl' | 'tb' | 'bt'
    gap: CSSValue
    components: Component[]
}

export type Component = TextComponent | ImageComponent | SimpleContainerComponent | FlowContainerComponent

export type CardDocument = {
    version: 1
    canvas: {
        width: number
        height: number
    }
    components: Component[]
}