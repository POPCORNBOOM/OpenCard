import { describe, expect, it } from 'vitest'
import { buildFontCatalog, findProjectFontRegistryIssues, fromCssFontFamily, resolveProjectFontExpression, setProjectFonts, toCssFontFamily } from './projectFonts'

const latin = { key: 'brand-latin', name: 'Latin', files: { normal: { upright: 'fonts/Brand.woff2' } } }
const cjk = { key: 'brand-cjk', name: 'CJK', files: { normal: { upright: 'fonts/CJK.ttf' } } }
const body = { key: 'body', name: 'Body', members: [{ fontKey: 'brand-latin', ranges: [{ start: 0, end: 127 }] }, { fontKey: 'brand-cjk' }] }

describe('project font catalog', () => {
  it('resolves font and composition references', () => {
    setProjectFonts([latin, cjk], [body])
    const catalog = buildFontCatalog({ 'brand-latin': { kind: 'family', name: 'Latin', family: latin }, body: { kind: 'composition', name: 'Body', composition: body } })
    expect(catalog.find(entry => entry.value === 'font:body')?.detail).toBe('brand-latin → brand-cjk')
    expect(toCssFontFamily('font:brand-latin')).toBe('"OpenCardProjectFont-brand-latin"')
    expect(fromCssFontFamily('"OpenCardProjectFont-brand-latin", sans-serif')).toBe('font:brand-latin; sans-serif')
    expect(resolveProjectFontExpression('font:body').familyKeys).toEqual(['brand-latin', 'brand-cjk'])
  })

  it('reports missing fonts and empty compositions', () => {
    expect(findProjectFontRegistryIssues({
      families: [{ key: 'empty', name: 'Empty', files: {} }],
      compositions: [{ key: 'missing', name: 'Missing', members: [{ fontKey: 'unknown' }] }, { key: 'none', name: 'None', members: [] }],
    })).toEqual([
      { kind: 'empty-font', fontKey: 'empty' },
      { kind: 'missing-font', compositionKey: 'missing', fontKey: 'unknown' },
      { kind: 'empty-composition', compositionKey: 'none' },
    ])
  })
})
