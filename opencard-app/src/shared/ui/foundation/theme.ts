import { DEFAULT_OC_THEME, OC_THEME_REGISTRY } from './themes'
import type { OcThemeId, OcThemeTokenKey } from './themeTokens'

let currentTheme: OcThemeId = DEFAULT_OC_THEME

function normalizeThemeId(themeId: string): OcThemeId {
  if (themeId === 'dark' || themeId === 'light') {
    return themeId
  }

  console.warn(`[OpenCard/UI] Unknown theme "${themeId}", fallback to "${DEFAULT_OC_THEME}".`)
  return DEFAULT_OC_THEME
}

function applyTheme(themeId: OcThemeId) {
  if (typeof document === 'undefined') {
    currentTheme = themeId
    return
  }

  const root = document.documentElement
  const tokens = OC_THEME_REGISTRY[themeId]
  for (const [token, value] of Object.entries(tokens)) {
    root.style.setProperty(token as OcThemeTokenKey, value)
  }

  root.dataset.ocTheme = themeId
  currentTheme = themeId
}

export function setOcTheme(themeId: OcThemeId | string): void {
  applyTheme(normalizeThemeId(themeId))
}

export function getOcTheme(): OcThemeId {
  return currentTheme
}

