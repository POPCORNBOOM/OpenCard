import { describe, expect, it } from 'vitest'
import {
  buildFontCatalog,
  fromCssFontFamily,
  normalizeProjectFontDirectory,
  resolveProjectFontExpression,
  setProjectFonts,
  toCssFontFamily,
} from './projectFonts'

describe('project font catalog', () => {
  it('resolves direct fonts and nested font sets with stable deduplication', () => {
    setProjectFonts([
      { key: 'brand-latin', name: 'Latin', source: 'assets/fonts/Brand.woff2' },
      { key: 'brand-cjk', name: 'CJK', source: 'assets/fonts/BrandCJK.woff2' },
    ], [
      { key: 'cjk', name: 'CJK fallback', fontKeys: ['brand-cjk'] },
      { key: 'body', name: 'Body', fontKeys: ['brand-latin', 'cjk', 'brand-latin'] },
    ])
    const catalog = buildFontCatalog({
      body: {
        name: 'Body',
        source: 'font:brand-latin; font:cjk',
      },
    })

    expect(catalog.find(entry => entry.value === 'font:body')).toMatchObject({
      value: 'font:body',
      label: 'Body',
      source: 'project',
    })
    const projectCss = '"OpenCardProjectFontSet-body", "OpenCardProjectFont-brand-latin", "OpenCardProjectFont-brand-cjk"'
    expect(toCssFontFamily('font:body')).toBe(projectCss)
    expect(fromCssFontFamily(projectCss)).toBe('font:body')
    expect(toCssFontFamily('Arial')).toBe('Arial')
    expect(toCssFontFamily('font:body; Microsoft YaHei; sans-serif'))
      .toBe(`${projectCss}, Microsoft YaHei, sans-serif`)
    expect(fromCssFontFamily('"OpenCardProjectFont-brand-latin", "Microsoft YaHei", sans-serif'))
      .toBe('font:brand-latin; Microsoft YaHei; sans-serif')
  })

  it('skips missing and cyclic branches while preserving valid fonts', () => {
    setProjectFonts([
      { key: 'a', name: 'A', source: 'a.ttf' },
      { key: 'b', name: 'B', source: 'b.ttf' },
    ], [
      { key: 'first', name: 'First', fontKeys: ['a', 'second', 'missing'] },
      { key: 'second', name: 'Second', fontKeys: ['b', 'first'] },
    ])

    const result = resolveProjectFontExpression('font:first;font:a;font:b')
    expect(result.fontKeys).toEqual(['a', 'b'])
    expect(result.issues).toEqual([
      { kind: 'cycle', key: 'first', path: ['first', 'second', 'first'] },
      { kind: 'missing', key: 'missing', path: ['first'] },
    ])
  })

  it('normalizes only safe project-relative font directories', () => {
    expect(normalizeProjectFontDirectory(' resources\\fonts/ ')).toBe('resources/fonts')
    expect(normalizeProjectFontDirectory('../fonts')).toBeNull()
    expect(normalizeProjectFontDirectory('D:/fonts')).toBeNull()
  })
})
