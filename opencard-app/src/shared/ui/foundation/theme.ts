import { DEFAULT_OC_THEME, OC_THEME_REGISTRY } from './themes'
import {
  OC_EDITABLE_THEME_COLOR_KEYS,
  OC_THEME_TOKEN_KEYS,
  type OcThemeColorOverrides,
  type OcThemeId,
  type OcThemeTokens,
} from './themeTokens'

let currentTheme: OcThemeId = DEFAULT_OC_THEME

function normalizeThemeId(themeId: string): OcThemeId {
  if (themeId === 'dark' || themeId === 'light') {
    return themeId
  }
  console.warn(`[OpenCard/UI] Unknown theme "${themeId}", fallback to "${DEFAULT_OC_THEME}".`)
  return DEFAULT_OC_THEME
}

type Rgb = readonly [number, number, number]

function parseHex(value: string): Rgb | null {
  if (!/^#[0-9a-f]{6}$/i.test(value)) return null
  return [1, 3, 5].map(index => Number.parseInt(value.slice(index, index + 2), 16)) as unknown as Rgb
}

function toHex(channels: Rgb): string {
  return `#${channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function withAlpha(color: string, alpha: number): string {
  return `${color.toUpperCase()}${Math.round(alpha * 255).toString(16).padStart(2, '0').toUpperCase()}`
}

function luminance(channels: Rgb): number {
  const [red, green, blue] = channels.map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return red! * 0.2126 + green! * 0.7152 + blue! * 0.0722
}

export function getReadableForegroundTone(value: string): 'dark' | 'light' {
  const color = parseHex(value) ?? [0, 0, 0]
  const dark: Rgb = [31, 36, 48]
  const light: Rgb = [245, 242, 255]
  return contrast(dark, color) >= contrast(light, color) ? 'dark' : 'light'
}

function contrast(left: Rgb, right: Rgb): number {
  const brighter = Math.max(luminance(left), luminance(right))
  const darker = Math.min(luminance(left), luminance(right))
  return (brighter + 0.05) / (darker + 0.05)
}

function mix(left: Rgb, right: Rgb, amount: number): Rgb {
  return left.map((channel, index) => channel + (right[index]! - channel) * amount) as unknown as Rgb
}

export function deriveAccentNeighborColor(value: string, angleDegrees = -50): string {
  const rgb = parseHex(value)
  if (!rgb) return value
  const [red, green, blue] = rgb.map(channel => channel / 255)
  const maximum = Math.max(red!, green!, blue!)
  const minimum = Math.min(red!, green!, blue!)
  const delta = maximum - minimum
  const lightness = (maximum + minimum) / 2
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
  let hue = 0
  if (delta > 0) {
    if (maximum === red) hue = ((green! - blue!) / delta) % 6
    else if (maximum === green) hue = (blue! - red!) / delta + 2
    else hue = (red! - green!) / delta + 4
    hue *= 60
  }
  hue = (hue + 360 + angleDegrees % 360) % 360
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const sector = hue / 60
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1))
  const offset = lightness - chroma / 2
  let channels: Rgb
  if (sector < 1) channels = [chroma, secondary, 0]
  else if (sector < 2) channels = [secondary, chroma, 0]
  else if (sector < 3) channels = [0, chroma, secondary]
  else if (sector < 4) channels = [0, secondary, chroma]
  else if (sector < 5) channels = [secondary, 0, chroma]
  else channels = [chroma, 0, secondary]
  return toHex(channels.map(channel => (channel + offset) * 255) as unknown as Rgb)
}

function readableAccent(accent: Rgb, background: Rgb): string {
  if (contrast(accent, background) >= 4.5) return toHex(accent)
  const dark: Rgb = [31, 36, 48]
  const light: Rgb = [245, 242, 255]
  const target = contrast(dark, background) >= contrast(light, background) ? dark : light
  for (let amount = 0.1; amount <= 1; amount += 0.1) {
    const candidate = mix(accent, target, amount)
    if (contrast(candidate, background) >= 4.5) return toHex(candidate)
  }
  return toHex(target)
}

function accentForeground(accent: Rgb): string {
  const dark: Rgb = [31, 36, 48]
  const light: Rgb = [245, 242, 255]
  return toHex(contrast(dark, accent) >= contrast(light, accent) ? dark : light)
}

export function resolveOcThemeTokens(
  themeId: OcThemeId,
  overrides: OcThemeColorOverrides = {},
  accentNeighborAngle = -50,
): OcThemeTokens {
  const tokens: OcThemeTokens = { ...OC_THEME_REGISTRY[themeId] }
  for (const token of OC_EDITABLE_THEME_COLOR_KEYS) {
    const value = overrides[token]
    if (value && parseHex(value)) tokens[token] = value
  }

  const baseValue = tokens['--oc-bg-base']
  const foregroundValue = tokens['--oc-fg-default']
  const base = parseHex(baseValue)
  const foreground = parseHex(foregroundValue)
  const usesLightForeground = getReadableForegroundTone(baseValue) === 'light'
  const white: Rgb = [255, 255, 255]

  if (base && overrides['--oc-bg-base']) {
    tokens['--oc-bg-surface'] = toHex(mix(base, white, usesLightForeground ? 0.045 : 0.7))
    tokens['--oc-bg-raised'] = toHex(mix(base, white, usesLightForeground ? 0.09 : 0.35))
    tokens['--oc-bg-input'] = toHex(mix(base, white, usesLightForeground ? 0.14 : 0.72))
  }

  if (base && foreground && (overrides['--oc-bg-base'] || overrides['--oc-fg-default'])) {
    tokens['--oc-bg-hover'] = withAlpha(foregroundValue, usesLightForeground ? 0.06 : 0.05)
    tokens['--oc-border-muted'] = toHex(mix(base, foreground, 0.1))
    tokens['--oc-border-default'] = toHex(mix(base, foreground, 0.16))
    tokens['--oc-border-strong'] = toHex(mix(base, foreground, 0.28))
    tokens['--oc-fg-muted'] = toHex(mix(foreground, base, 0.4))
    tokens['--oc-fg-subtle'] = toHex(mix(foreground, base, 0.62))
    tokens['--oc-fg-disabled'] = toHex(mix(foreground, base, 0.7))
    tokens['--oc-icon-muted'] = tokens['--oc-fg-muted']
    tokens['--oc-scrollbar-thumb'] = withAlpha(foregroundValue, 0.3)
    tokens['--oc-scrollbar-thumb-hover'] = withAlpha(foregroundValue, 0.46)
  }

  const accentValue = tokens['--oc-accent']
  const accent = parseHex(accentValue)
  tokens['--oc-accent-neighbor'] = deriveAccentNeighborColor(accentValue, accentNeighborAngle)
  if (accent) {
    const surface = parseHex(tokens['--oc-bg-surface']) ?? base!
    tokens['--oc-bg-active'] = withAlpha(accentValue, usesLightForeground ? 0.22 : 0.18)
    tokens['--oc-bg-selected'] = withAlpha(accentValue, usesLightForeground ? 0.16 : 0.12)
    tokens['--oc-bg-accent'] = accentValue
    tokens['--oc-bg-accent-hover'] = withAlpha(accentValue, usesLightForeground ? 0.92 : 0.84)
    tokens['--oc-bg-accent-subtle'] = withAlpha(accentValue, usesLightForeground ? 0.12 : 0.1)
    tokens['--oc-border-accent'] = accentValue
    tokens['--oc-accent-fg'] = accentForeground(accent)
    tokens['--oc-accent-glow'] = withAlpha(accentValue, usesLightForeground ? 0.28 : 0.35)
    tokens['--oc-fg-accent'] = readableAccent(accent, surface)
    tokens['--oc-icon-accent'] = tokens['--oc-fg-accent']
    tokens['--oc-focus-ring'] = `0 0 0 2px ${withAlpha(accentValue, usesLightForeground ? 0.4 : 0.5)}`
  }
  return tokens
}

function applyTheme(
  themeId: OcThemeId,
  overrides: OcThemeColorOverrides,
  accentNeighborAngle: number,
) {
  if (typeof document === 'undefined') {
    currentTheme = themeId
    return
  }

  const root = document.documentElement
  const tokens = resolveOcThemeTokens(themeId, overrides, accentNeighborAngle)
  for (const token of OC_THEME_TOKEN_KEYS) {
    const value = tokens[token]
    if (typeof value !== 'string') {
      console.warn(`[OpenCard/UI] Missing theme token "${token}" in theme "${themeId}".`)
      continue
    }
    root.style.setProperty(token, value)
  }

  root.style.colorScheme = themeId
  root.dataset.ocTheme = themeId
  currentTheme = themeId
}

export function setOcTheme(
  themeId: OcThemeId | string,
  overrides: OcThemeColorOverrides = {},
  accentNeighborAngle = -50,
): void {
  applyTheme(normalizeThemeId(themeId), overrides, accentNeighborAngle)
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
