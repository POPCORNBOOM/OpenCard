/**
 * 主题实例 — 深色与浅色主题的完整 token 值映射。
 */
import type { OcThemeId, OcThemeTokens } from './themeTokens'

const sharedThemeTokens = {
  '--oc-scrollbar-size': '8px',
  '--oc-bg-accent': '#A260FF',
  '--oc-bg-glass-blur': '18px',
  '--oc-bg-glass-saturate': '120%',
  '--oc-border-accent': '#A260FF',
  '--oc-accent': '#A260FF',
  '--oc-accent-neighbor': '#60A2FF',
  '--oc-accent-fg': '#f5f2ff',
  '--oc-icon-default': 'currentColor',
  '--oc-icon-size-sm': '12px',
  '--oc-icon-size-md': '16px',
  '--oc-icon-size-lg': '20px',
  '--oc-font-sans': '"Segoe UI Variable Text", "SF Pro Text", "Inter", "PingFang SC", "Microsoft YaHei UI", "Noto Sans CJK SC", sans-serif',
  '--oc-font-mono': '"Cascadia Code", "JetBrains Mono", "SF Mono", "Consolas", "Fira Code", monospace',
  '--oc-text-xs': '10px',
  '--oc-text-sm': '11px',
  '--oc-text-base': '12px',
  '--oc-text-lg': '13px',
  '--oc-text-xl': '16px',
  '--oc-font-preview-size': '48px',
  '--oc-space-1': '4px',
  '--oc-space-2': '6px',
  '--oc-space-3': '8px',
  '--oc-space-4': '12px',
  '--oc-space-5': '16px',
  '--oc-space-6': '20px',
  '--oc-space-8': '32px',
  '--oc-tree-indent': '14px',
  '--oc-tree-action-label-min-width': '64px',
  '--oc-size-sm': '22px',
  '--oc-size-md': '28px',
  '--oc-size-lg': '36px',
  '--oc-color-picker-plane-height': '132px',
  '--oc-color-channel-track-height': '12px',
  '--oc-color-channel-handle-width': '8px',
  '--oc-color-channel-handle-height': '16px',
  '--oc-color-channel-handle-border-width': '2px',
  '--oc-color-channel-handle-border-color': '#FFFFFF',
  '--oc-color-channel-handle-shadow': '0 0 0 1px rgb(0 0 0 / 55%)',
  '--oc-list-max-height-sm': '144px',
  '--oc-list-max-height-md': '240px',
  '--oc-list-max-height-lg': '320px',
  '--oc-content-width-md': '720px',
  '--oc-project-icon-atlas-height': '240px',
  '--oc-project-icon-property-min-width': '280px',
  '--oc-project-icon-inspector-min-height': '240px',
  '--oc-project-icon-workbench-series-width': '48%',
  '--oc-project-icon-workbench-inspector-width': '320px',
  '--oc-project-icon-workbench-icon-list-height': '280px',
  '--oc-project-icon-preview-size': '128px',
  '--oc-overlay-toolbar-field-min-width': '48px',
  '--oc-overlay-toolbar-field-max-width': '56px',
  '--oc-z-modal': '1000',
  '--oc-z-overlay-toolbar': '3',
  '--oc-property-row-height': '28px',
  '--oc-property-row-expanded-height': '112px',
  '--oc-table-row-height': '32px',
  '--oc-radius-sm': '3px',
  '--oc-radius-md': '6px',
  '--oc-radius-lg': '12px',
  '--oc-radius-full': '999px',
  '--oc-border-width': '1px',
  '--oc-duration-fast': '100ms',
  '--oc-duration-normal': '150ms',
  '--oc-duration-slow': '250ms',
  '--oc-ease': 'cubic-bezier(0.2, 0, 0, 1)',
} as const satisfies Partial<OcThemeTokens>

const darkTheme: OcThemeTokens = {
  ...sharedThemeTokens,
  '--oc-scrollbar-thumb': 'rgba(156, 156, 156, 0.32)',
  '--oc-scrollbar-thumb-hover': 'rgba(186, 186, 186, 0.48)',

  '--oc-bg-base': '#1e1e1e',
  '--oc-bg-surface': '#252526',
  '--oc-bg-block': '#222223',
  '--oc-bg-raised': '#2d2d2d',

  '--oc-bg-hover': 'rgba(255, 255, 255, 0.04)',
  '--oc-bg-active': 'rgba(162, 96, 255, 0.22)',
  '--oc-bg-selected': 'rgba(162, 96, 255, 0.16)',

  '--oc-bg-input': '#3c3c3c',

  '--oc-bg-accent-hover': 'rgba(162, 96, 255, 0.92)',
  '--oc-bg-accent-subtle': 'rgba(162, 96, 255, 0.12)',

  '--oc-bg-danger-subtle': 'rgba(241, 76, 76, 0.12)',

  '--oc-bg-glass': 'rgba(28, 28, 28, 0.76)',

  '--oc-border-default': '#3a3d41',
  '--oc-border-muted': '#333333',
  '--oc-border-strong': '#51555b',
  '--oc-accent-glow': 'rgba(162, 96, 255, 0.28)',

  '--oc-danger': '#f14c4c',

  '--oc-fg-default': '#cccccc',
  '--oc-fg-muted': '#888888',
  '--oc-fg-subtle': '#666666',
  '--oc-fg-disabled': '#6f6f6f',
  '--oc-fg-accent': '#b8b0ff',
  '--oc-fg-danger': '#f85149',

  '--oc-icon-muted': '#8b949e',
  '--oc-icon-accent': '#9b90ff',
  '--oc-icon-success': '#3fb950',
  '--oc-icon-active': '#58a6ff',
  '--oc-icon-warning': '#d29922',
  '--oc-icon-danger': '#f85149',

  '--oc-icon-file-opencard': '#f59e0b',
  '--oc-icon-file-json': '#f5c542',
  '--oc-icon-file-markdown': '#8b949e',
  '--oc-icon-file-typescript': '#3178c6',
  '--oc-icon-file-javascript': '#f7df1e',
  '--oc-icon-file-vue': '#42b883',
  '--oc-icon-file-html': '#e34f26',
  '--oc-icon-file-css': '#1572b6',
  '--oc-icon-file-image': '#a855f7',
  '--oc-icon-file-config': '#10b981',
  '--oc-icon-folder': '#7d8590',
  '--oc-icon-folder-open': '#e3b341',

  '--oc-shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.18)',
  '--oc-shadow-md': '0 4px 12px rgba(0, 0, 0, 0.28)',
  '--oc-shadow-lg': '0 10px 28px rgba(0, 0, 0, 0.32)',

  '--oc-focus-ring': '0 0 0 2px rgba(162, 96, 255, 0.4)',
}

const lightTheme: OcThemeTokens = {
  ...sharedThemeTokens,
  '--oc-scrollbar-thumb': 'rgba(96, 108, 138, 0.3)',
  '--oc-scrollbar-thumb-hover': 'rgba(72, 84, 116, 0.46)',

  '--oc-bg-base': '#f5f6fb',
  '--oc-bg-surface': '#ffffff',
  '--oc-bg-block': '#fbfbfd',
  '--oc-bg-raised': '#f8f9fd',

  '--oc-bg-hover': 'rgba(31, 36, 48, 0.05)',
  '--oc-bg-active': 'rgba(162, 96, 255, 0.18)',
  '--oc-bg-selected': 'rgba(162, 96, 255, 0.12)',

  '--oc-bg-input': '#ffffff',

  '--oc-bg-accent-hover': 'rgba(162, 96, 255, 0.84)',
  '--oc-bg-accent-subtle': 'rgba(162, 96, 255, 0.1)',

  '--oc-bg-danger-subtle': 'rgba(209, 67, 67, 0.1)',

  '--oc-bg-glass': 'rgba(245, 247, 253, 0.52)',

  '--oc-border-default': '#e3e6f2',
  '--oc-border-muted': '#eceef5',
  '--oc-border-strong': '#d0d4e3',
  '--oc-accent-glow': 'rgba(162, 96, 255, 0.35)',

  '--oc-danger': '#d14343',

  '--oc-fg-default': '#1f2430',
  '--oc-fg-muted': '#6d7487',
  '--oc-fg-subtle': '#a0a6b7',
  '--oc-fg-disabled': '#b8bcc9',
  '--oc-fg-accent': '#5a4fd6',
  '--oc-fg-danger': '#cf4444',

  '--oc-icon-muted': '#7f879a',
  '--oc-icon-accent': '#5b6de8',
  '--oc-icon-success': '#1f9d68',
  '--oc-icon-active': '#2563eb',
  '--oc-icon-warning': '#b77e18',
  '--oc-icon-danger': '#cf4444',

  '--oc-icon-file-opencard': '#f08c00',
  '--oc-icon-file-json': '#d89f00',
  '--oc-icon-file-markdown': '#7f879a',
  '--oc-icon-file-typescript': '#2962c7',
  '--oc-icon-file-javascript': '#c9b502',
  '--oc-icon-file-vue': '#2ea76f',
  '--oc-icon-file-html': '#cf4c2f',
  '--oc-icon-file-css': '#276ec9',
  '--oc-icon-file-image': '#8f55da',
  '--oc-icon-file-config': '#0d9d66',
  '--oc-icon-folder': '#737b90',
  '--oc-icon-folder-open': '#c98f2a',

  '--oc-shadow-sm': '0 1px 2px rgba(31, 36, 48, 0.1)',
  '--oc-shadow-md': '0 4px 12px rgba(31, 36, 48, 0.14)',
  '--oc-shadow-lg': '0 10px 28px rgba(31, 36, 48, 0.18)',

  '--oc-focus-ring': '0 0 0 2px rgba(162, 96, 255, 0.5)',
}

export const DEFAULT_OC_THEME: OcThemeId = 'dark'

export const OC_THEME_REGISTRY: Record<OcThemeId, OcThemeTokens> = {
  dark: darkTheme,
  light: lightTheme,
}
