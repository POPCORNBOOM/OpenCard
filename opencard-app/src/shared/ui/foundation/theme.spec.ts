import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OC_THEME, OC_THEME_REGISTRY } from './themes'
import { deriveAccentNeighborColor, getOcTheme, setOcTheme } from './theme'

const srcRoot = join(process.cwd(), 'src')
const sourceExtensions = new Set(['.css', '.ts', '.vue'])
const fileIconColorTokens = [
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
] as const
const blockIconColorTokens = [
  '--oc-icon-block-text',
  '--oc-icon-block-markdown',
  '--oc-icon-block-image',
  '--oc-icon-block-qrcode',
  '--oc-icon-block-shape',
  '--oc-icon-block-simple-container',
  '--oc-icon-block-flow-container',
] as const

function readProductionSources(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .map((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) return readProductionSources(path)
      if (!sourceExtensions.has(extname(entry.name)) || entry.name.endsWith('.spec.ts')) return ''
      return readFileSync(path, 'utf8')
    })
    .join('\n')
}

afterEach(() => {
  document.documentElement.removeAttribute('style')
  delete document.documentElement.dataset.ocTheme
  vi.restoreAllMocks()
})

describe('OC theme runtime', () => {
  it('derives an accent neighbor at the configurable hue offset', () => {
    expect(deriveAccentNeighborColor('#FF0000')).toBe('#FF00D4')
    expect(deriveAccentNeighborColor('#FF0000', 50)).toBe('#FFD500')
    expect(deriveAccentNeighborColor('#808080')).toBe('#808080')
  })

  it.each(['dark', 'light'] as const)('applies %s tokens and native color scheme', (themeId) => {
    setOcTheme(themeId)

    expect(getOcTheme()).toBe(themeId)
    expect(document.documentElement.dataset.ocTheme).toBe(themeId)
    expect(document.documentElement.style.colorScheme).toBe(themeId)
    expect(document.documentElement.style.getPropertyValue('--oc-bg-base'))
      .toBe(OC_THEME_REGISTRY[themeId]['--oc-bg-base'])
    expect(document.documentElement.style.getPropertyValue('--oc-bg-block'))
      .toBe(OC_THEME_REGISTRY[themeId]['--oc-bg-block'])
    expect(document.documentElement.style.getPropertyValue('--oc-table-row-height'))
      .toBe(OC_THEME_REGISTRY[themeId]['--oc-table-row-height'])
    expect(document.documentElement.style.getPropertyValue('--oc-border-width'))
      .toBe(OC_THEME_REGISTRY[themeId]['--oc-border-width'])
    expect(document.documentElement.style.getPropertyValue('--oc-viewport-dot-pattern'))
      .toBe(OC_THEME_REGISTRY[themeId]['--oc-viewport-dot-pattern'])
  })

  it.each(['dark', 'light'] as const)('uses distinct OKLCH file and Block icon colors in %s', (themeId) => {
    const fileColors = fileIconColorTokens.map(token => OC_THEME_REGISTRY[themeId][token])
    const blockColors = blockIconColorTokens.map(token => OC_THEME_REGISTRY[themeId][token])
    const isOklchColor = (value: string) => /^oklch\([\d.]+% [\d.]+ [\d.]+\)$/.test(value)

    expect(fileColors.every(isOklchColor)).toBe(true)
    expect(blockColors.every(isOklchColor)).toBe(true)
    expect(new Set(fileColors).size).toBe(fileColors.length)
    expect(new Set(blockColors).size).toBe(blockColors.length)
  })

  it('falls back unknown themes to the default theme', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    setOcTheme('unknown')

    expect(getOcTheme()).toBe(DEFAULT_OC_THEME)
    expect(document.documentElement.dataset.ocTheme).toBe(DEFAULT_OC_THEME)
    expect(document.documentElement.style.colorScheme).toBe(DEFAULT_OC_THEME)
  })

  it('applies editable overrides after the built-in theme', () => {
    setOcTheme('light', { '--oc-accent': '#123456', '--oc-bg-base': '#ABCDEF' })

    expect(document.documentElement.style.getPropertyValue('--oc-accent')).toBe('#123456')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-accent')).toBe('#123456')
    expect(document.documentElement.style.getPropertyValue('--oc-border-accent')).toBe('#123456')
    expect(document.documentElement.style.getPropertyValue('--oc-accent-neighbor'))
      .toBe(deriveAccentNeighborColor('#123456'))
    expect(document.documentElement.style.getPropertyValue('--oc-bg-active')).toBe('#1234562E')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-selected')).toBe('#1234561F')
    expect(document.documentElement.style.getPropertyValue('--oc-fg-accent')).not.toBe('#5a4fd6')
    expect(document.documentElement.style.getPropertyValue('--oc-icon-accent')).not.toBe('#5b6de8')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-base')).toBe('#ABCDEF')
  })

  it('derives surface, border, and muted text families from background and foreground', () => {
    setOcTheme('light', { '--oc-bg-base': '#EFEFEF', '--oc-fg-default': '#202020' })

    expect(document.documentElement.style.getPropertyValue('--oc-bg-surface')).toBe('#FAFAFA')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-raised')).toBe('#F5F5F5')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-input')).toBe('#FBFBFB')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-block')).toBe('#F5F5F5')
    expect(document.documentElement.style.getPropertyValue('--oc-border-default')).toBe('#CECECE')
    expect(document.documentElement.style.getPropertyValue('--oc-fg-muted')).toBe('#737373')
    expect(document.documentElement.style.getPropertyValue('--oc-fg-subtle')).toBe('#A0A0A0')
  })

  it('keeps Block surfaces in the selected dark background family', () => {
    setOcTheme('dark', { '--oc-bg-base': '#34251A' })

    expect(document.documentElement.style.getPropertyValue('--oc-bg-surface')).toBe('#3D2F24')
    expect(document.documentElement.style.getPropertyValue('--oc-bg-block')).toBe('#392A1F')
  })

  it('derives the type scale and font family from typography preferences', () => {
    setOcTheme('dark', {}, -50, { fontFamily: 'Inter; Noto Serif CJK SC', baseFontSize: 14 })

    expect(document.documentElement.style.getPropertyValue('--oc-font-sans')).toContain('Noto Serif')
    expect(document.documentElement.style.getPropertyValue('--oc-font-sans')).toContain('"Inter", "Noto Serif CJK SC"')
    expect(document.documentElement.style.getPropertyValue('--oc-text-xs')).toBe('12px')
    expect(document.documentElement.style.getPropertyValue('--oc-text-sm')).toBe('13px')
    expect(document.documentElement.style.getPropertyValue('--oc-text-base')).toBe('14px')
    expect(document.documentElement.style.getPropertyValue('--oc-text-lg')).toBe('15px')
    expect(document.documentElement.style.getPropertyValue('--oc-text-xl')).toBe('19px')
    expect(document.documentElement.style.getPropertyValue('--oc-font-preview-size')).toBe('56px')
  })
})

describe('theme source boundary', () => {
  it('does not restore legacy Shell color aliases or theme classes', () => {
    const source = readProductionSources(srcRoot)

    expect(source).not.toContain('--color-')
    expect(source).not.toContain('shell-theme-graphite')
    expect(source).not.toContain('shell-theme-light')
  })
})
