/**
 * Token 注册表 — 组件 prop 可选值的唯一真相来源。
 * 每个枚举对应一个组件 prop 的所有合法值。
 */

// ─── 布局 ───────────────────────────────────────────────
export const OC_ORIENTATIONS = ['horizontal', 'vertical'] as const
export type OcOrientation = (typeof OC_ORIENTATIONS)[number]

export const OC_GAP_TOKENS = ['none', '1', '2', '3', '4', '5', '6', '8'] as const
export type OcGap = (typeof OC_GAP_TOKENS)[number]

export const OC_PADDING_TOKENS = ['none', '1', '2', '3', '4', '5', '6'] as const
export type OcPadding = (typeof OC_PADDING_TOKENS)[number]

export const OC_ALIGN_TOKENS = ['start', 'center', 'end', 'stretch'] as const
export type OcAlign = (typeof OC_ALIGN_TOKENS)[number]

export const OC_JUSTIFY_TOKENS = ['start', 'center', 'end', 'between'] as const
export type OcJustify = (typeof OC_JUSTIFY_TOKENS)[number]

export const OC_OVERFLOW_TOKENS = ['visible', 'hidden', 'auto', 'scroll'] as const
export type OcOverflow = (typeof OC_OVERFLOW_TOKENS)[number]

// ─── 尺寸 ───────────────────────────────────────────────
export const OC_SIZE_TOKENS = ['sm', 'md', 'lg'] as const
export type OcSize = (typeof OC_SIZE_TOKENS)[number]

// ─── 表面 ───────────────────────────────────────────────
export const OC_TONE_TOKENS = ['base', 'surface', 'raised', 'glass', 'accent', 'transparent'] as const
export type OcTone = (typeof OC_TONE_TOKENS)[number]

export const OC_RADIUS_TOKENS = ['none', 'sm', 'md', 'lg', 'full'] as const
export type OcRadius = (typeof OC_RADIUS_TOKENS)[number]

export const OC_SHADOW_TOKENS = ['none', 'sm', 'md', 'lg'] as const
export type OcShadow = (typeof OC_SHADOW_TOKENS)[number]

export const OC_BORDER_TOKENS = ['none', 'default', 'muted', 'strong', 'accent'] as const
export type OcBorder = (typeof OC_BORDER_TOKENS)[number]

// ─── 按钮 ───────────────────────────────────────────────
export const OC_BUTTON_VARIANTS = ['solid', 'soft', 'ghost', 'outline'] as const
export type OcButtonVariant = (typeof OC_BUTTON_VARIANTS)[number]

// ─── 文本 ───────────────────────────────────────────────
export const OC_TEXT_SIZE_TOKENS = ['xs', 'sm', 'base', 'lg', 'xl'] as const
export type OcTextSize = (typeof OC_TEXT_SIZE_TOKENS)[number]

export const OC_TEXT_TONE_TOKENS = ['default', 'muted', 'subtle', 'accent', 'danger'] as const
export type OcTextTone = (typeof OC_TEXT_TONE_TOKENS)[number]

// ─── 输入 ───────────────────────────────────────────────
export const OC_INPUT_VARIANTS = ['filled', 'plain'] as const
export type OcInputVariant = (typeof OC_INPUT_VARIANTS)[number]

// ─── Token → CSS 值解析函数 ─────────────────────────────
export function resolveGap(token: OcGap): string {
  if (token === 'none') return '0'
  return `var(--oc-space-${token})`
}

export function resolvePadding(token: OcPadding): string {
  if (token === 'none') return '0'
  return `var(--oc-space-${token})`
}
