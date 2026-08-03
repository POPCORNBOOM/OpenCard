import { describe, expect, it } from 'vitest'
import {
  buildFontCatalog,
  fromCssFontFamily,
  normalizeProjectFontDirectory,
  toCssFontFamily,
} from './projectFonts'

describe('project font catalog', () => {
  it('uses stable project references and CSS-safe family names', () => {
    const catalog = buildFontCatalog({
      'brand-sans': {
        name: 'Brand Sans',
        source: 'assets/fonts/BrandSans.woff2',
      },
    })

    expect(catalog[0]).toMatchObject({
      value: 'font:brand-sans',
      label: 'Brand Sans',
      source: 'project',
    })
    expect(toCssFontFamily('font:brand-sans')).toBe('"OpenCardProjectFont-brand-sans"')
    expect(fromCssFontFamily('"OpenCardProjectFont-brand-sans"')).toBe('font:brand-sans')
    expect(toCssFontFamily('Arial')).toBe('Arial')
    expect(toCssFontFamily('font:brand-sans; Microsoft YaHei; sans-serif'))
      .toBe('"OpenCardProjectFont-brand-sans", Microsoft YaHei, sans-serif')
    expect(fromCssFontFamily('"OpenCardProjectFont-brand-sans", "Microsoft YaHei", sans-serif'))
      .toBe('font:brand-sans; Microsoft YaHei; sans-serif')
  })

  it('normalizes only safe project-relative font directories', () => {
    expect(normalizeProjectFontDirectory(' resources\\fonts/ ')).toBe('resources/fonts')
    expect(normalizeProjectFontDirectory('../fonts')).toBeNull()
    expect(normalizeProjectFontDirectory('D:/fonts')).toBeNull()
  })
})
