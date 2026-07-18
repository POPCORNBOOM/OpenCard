/**
 * 模块说明：
 * - 定义项目图标渲染的基础类型
 * 职责边界：
 * - 只描述图标数据结构，不包含解析规则
 */
export type IconGlyph = {
  path: string
  viewBox?: string
}
