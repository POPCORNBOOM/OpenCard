import { DEFAULT_OC_THEME, OC_THEME_REGISTRY } from './themes'
import { OC_THEME_TOKEN_KEYS, type OcThemeId } from './themeTokens'

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
  for (const token of OC_THEME_TOKEN_KEYS) {
    const value = tokens[token]
    if (typeof value !== 'string') {
      console.warn(`[OpenCard/UI] Missing theme token "${token}" in theme "${themeId}".`)
      continue
    }
    root.style.setProperty(token, value)
  }

  root.dataset.ocTheme = themeId
  currentTheme = themeId
}

export function setOcTheme(themeId: OcThemeId | string): void {
  applyTheme(normalizeThemeId(themeId))
}

export function setOcGlassIntensity(value: number): void {
  if (typeof document === 'undefined') return
  const intensity = Math.min(100, Math.max(0, Math.round(value)))
  const blur = intensity * 0.24
  const opacity = 100 - intensity * 0.4
  const saturation = 100 + intensity * 0.4
  const root = document.documentElement

  root.style.setProperty('--oc-bg-glass', `color-mix(in srgb, var(--oc-bg-surface) ${opacity}%, transparent)`)
  root.style.setProperty('--oc-bg-glass-blur', `${blur}px`)
  root.style.setProperty('--oc-blur-glass', `${blur}px`)
  root.style.setProperty('--oc-bg-glass-saturate', `${saturation}%`)
  root.dataset.ocGlassIntensity = String(intensity)
}

export function getOcTheme(): OcThemeId {
  return currentTheme
}
