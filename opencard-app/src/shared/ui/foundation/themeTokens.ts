/**
 * 主题 Token 键集合 — 定义 UI 系统中所有可主题化的 CSS 变量。
 * "中庸"原则：只保留实际被多处使用的语义 token，不过度细分。
 */
export type OcThemeId = 'dark' | 'light'

export const OC_THEME_TOKEN_KEYS = [
  // 滚动条
  '--oc-scrollbar-size',
  '--oc-scrollbar-thumb',
  '--oc-scrollbar-thumb-hover',

  // 背景 — 层级
  '--oc-bg-base',
  '--oc-bg-surface',
  '--oc-bg-block',
  '--oc-bg-raised',

  // 背景 — 交互态
  '--oc-bg-hover',
  '--oc-bg-active',
  '--oc-bg-selected',

  // 背景 — 输入
  '--oc-bg-input',

  // 背景 — 强调
  '--oc-bg-accent',
  '--oc-bg-accent-hover',
  '--oc-bg-accent-subtle',

  // 背景 — 危险
  '--oc-bg-danger-subtle',

  // 背景 — 特殊
  '--oc-bg-glass',
  '--oc-bg-glass-blur',
  '--oc-bg-glass-saturate',

  // 边框
  '--oc-border-width',
  '--oc-border-default',
  '--oc-border-muted',
  '--oc-border-strong',
  '--oc-border-accent',

  // 强调色
  '--oc-accent',
  '--oc-accent-neighbor',
  '--oc-accent-fg',
  '--oc-accent-glow',

  // 危险色
  '--oc-danger',

  // 文本
  '--oc-fg-default',
  '--oc-fg-muted',
  '--oc-fg-subtle',
  '--oc-fg-disabled',
  '--oc-fg-accent',
  '--oc-fg-danger',

  // 图标
  '--oc-icon-default',
  '--oc-icon-muted',
  '--oc-icon-accent',
  '--oc-icon-success',
  '--oc-icon-active',
  '--oc-icon-warning',
  '--oc-icon-danger',

  // 图标尺寸
  '--oc-icon-size-sm',
  '--oc-icon-size-md',
  '--oc-icon-size-lg',

  // 文件类型图标色
  '--oc-icon-file-opencard',
  '--oc-icon-file-json',
  '--oc-icon-file-markdown',
  '--oc-icon-file-typescript',
  '--oc-icon-file-javascript',
  '--oc-icon-file-vue',
  '--oc-icon-file-html',
  '--oc-icon-file-css',
  '--oc-icon-file-image',
  '--oc-icon-file-config',
  '--oc-icon-folder',
  '--oc-icon-folder-open',

  // 字体
  '--oc-font-sans',
  '--oc-font-mono',

  // 字号
  '--oc-text-xs',
  '--oc-text-sm',
  '--oc-text-base',
  '--oc-text-lg',
  '--oc-text-xl',

  // 间距
  '--oc-space-1',
  '--oc-space-2',
  '--oc-space-3',
  '--oc-space-4',
  '--oc-space-5',
  '--oc-space-6',
  '--oc-space-8',

  // 控件高度
  '--oc-size-sm',
  '--oc-size-md',
  '--oc-size-lg',

  // 列表高度上限
  '--oc-list-max-height-sm',
  '--oc-list-max-height-md',
  '--oc-list-max-height-lg',

  // 页面内容宽度
  '--oc-content-width-md',

  // 属性编辑器行高
  '--oc-property-row-height',
  '--oc-property-row-expanded-height',

  // 数据表行高
  '--oc-table-row-height',

  // 圆角
  '--oc-radius-sm',
  '--oc-radius-md',
  '--oc-radius-lg',
  '--oc-radius-full',

  // 阴影
  '--oc-shadow-sm',
  '--oc-shadow-md',
  '--oc-shadow-lg',

  // 动效
  '--oc-duration-fast',
  '--oc-duration-normal',
  '--oc-duration-slow',
  '--oc-ease',

  // 焦点环
  '--oc-focus-ring',
] as const

export type OcThemeTokenKey = (typeof OC_THEME_TOKEN_KEYS)[number]
export type OcThemeTokens = Record<OcThemeTokenKey, string>

export const OC_EDITABLE_THEME_COLOR_KEYS = [
  '--oc-accent',
  '--oc-bg-base',
  '--oc-fg-default',
] as const

export type OcEditableThemeColorKey = (typeof OC_EDITABLE_THEME_COLOR_KEYS)[number]
export type OcThemeColorOverrides = Partial<Record<OcEditableThemeColorKey, string>>
