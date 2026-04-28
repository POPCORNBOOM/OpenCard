/**
 * 模块说明：
 * - 定义图标跨库渲染的基础类型
 * 职责边界：
 * - 只描述图标数据结构，不包含解析规则
 */
export type IconPackId = 'codicon' | 'mdi'

export type CodiconIconGlyph = {
  pack: 'codicon'
  value: string
}

export type MdiIconGlyph = {
  pack: 'mdi'
  value: string
  viewBox?: string
}

export type IconGlyph = CodiconIconGlyph | MdiIconGlyph
