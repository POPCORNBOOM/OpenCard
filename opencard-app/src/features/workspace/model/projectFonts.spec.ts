import { describe, expect, it } from 'vitest'
import {
  buildFontCatalog,
  findProjectFontRegistryIssues,
  fromCssFontFamily,
  normalizeProjectFontDirectory,
  resolveProjectFontExpression,
  setProjectFonts,
  toCssFontFamily,
  unicodeRangeContains,
} from './projectFonts'

const latin = {
  key: 'brand-latin',
  name: 'Latin',
  faces: [{
    source: 'fonts/Brand.woff2',
    weight: { min: 400, max: 400 },
    stretch: { min: 100, max: 100 },
    style: { kind: 'normal' as const },
  }],
}
const cjk = { ...latin, key: 'brand-cjk', name: 'CJK', faces: [{ ...latin.faces[0]!, source: 'fonts/CJK.ttf' }] }
const body = {
  key: 'body',
  name: 'Body',
  members: [{ familyKey: 'brand-latin', ranges: [{ start: 0, end: 127 }] }, { familyKey: 'brand-cjk' }],
}

describe('project font catalog', () => {
  it('resolves family and composition references without nested compositions', () => {
    setProjectFonts([latin, cjk], [body])
    const catalog = buildFontCatalog({
      'brand-latin': { kind: 'family', name: 'Latin', family: latin },
      body: { kind: 'composition', name: 'Body', composition: body },
    })

    expect(catalog.find(entry => entry.value === 'font:body')).toMatchObject({
      label: 'Body',
      detail: 'brand-latin → brand-cjk',
      source: 'project',
    })
    expect(toCssFontFamily('font:body')).toBe('"OpenCardProjectFontComposition-body"')
    expect(toCssFontFamily('font:brand-latin')).toBe('"OpenCardProjectFontFamily-brand-latin"')
    expect(fromCssFontFamily('"OpenCardProjectFontComposition-body", sans-serif'))
      .toBe('font:body; sans-serif')
    expect(resolveProjectFontExpression('font:body').familyKeys).toEqual(['brand-latin', 'brand-cjk'])
  })

  it('reports missing families and structurally empty entries', () => {
    const result = resolveProjectFontExpression('font:body; font:missing', {
      families: [latin],
      compositions: [{ ...body, members: [{ familyKey: 'brand-latin' }, { familyKey: 'missing' }] }],
    })
    expect(result.familyKeys).toEqual(['brand-latin'])
    expect(result.issues).toEqual([
      { kind: 'missing', key: 'missing', path: ['body'] },
      { kind: 'missing', key: 'missing', path: [] },
    ])
    expect(findProjectFontRegistryIssues({
      families: [{ key: 'empty', name: 'Empty', faces: [] }],
      compositions: [{ key: 'missing', name: 'Missing', members: [{ familyKey: 'unknown' }] }, { key: 'none', name: 'None', members: [] }],
    })).toEqual([
      { kind: 'empty-family', familyKey: 'empty' },
      { kind: 'missing-family', compositionKey: 'missing', familyKey: 'unknown' },
      { kind: 'empty-composition', compositionKey: 'none' },
    ])
  })

  it('checks Unicode membership and normalizes safe relative directories', () => {
    expect(unicodeRangeContains(undefined, 0x4e00)).toBe(true)
    expect(unicodeRangeContains([{ start: 0x41, end: 0x5a }], 0x41)).toBe(true)
    expect(unicodeRangeContains([{ start: 0x41, end: 0x5a }], 0x61)).toBe(false)
    expect(normalizeProjectFontDirectory(' resources\\fonts/ ')).toBe('resources/fonts')
    expect(normalizeProjectFontDirectory('../fonts')).toBeNull()
    expect(normalizeProjectFontDirectory('D:/fonts')).toBeNull()
  })
})
