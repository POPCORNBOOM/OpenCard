import { describe, expect, it } from 'vitest'
import {
  findOverlappingProjectFontFaces,
  normalizeUnicodeRanges,
  parseProjectFontRegistry,
  parseProjectFontRegistryText,
  serializeProjectFontRegistry,
} from './projectFontRegistry'

describe('project font registry', () => {
  it('normalizes font families, face defaults, and compositions', () => {
    expect(parseProjectFontRegistry({
      families: [{
        key: 'brand',
        name: ' Brand ',
        faces: [
          { source: 'fonts\\Brand-Regular.woff2' },
          {
            source: 'fonts/Brand-Italic.ttf',
            weight: { min: 300, max: 700 },
            stretch: { min: 75, max: 125 },
            style: { kind: 'italic' },
          },
        ],
      }],
      compositions: [{
        key: 'body',
        name: ' Body ',
        members: [
          { familyKey: 'brand', ranges: [{ start: 65, end: 90 }, { start: 91, end: 122 }] },
          { familyKey: 'fallback' },
        ],
      }],
    })).toEqual({
      families: [{
        key: 'brand',
        name: 'Brand',
        faces: [
          {
            source: 'fonts/Brand-Regular.woff2',
            weight: { min: 400, max: 400 },
            stretch: { min: 100, max: 100 },
            style: { kind: 'normal' },
          },
          {
            source: 'fonts/Brand-Italic.ttf',
            weight: { min: 300, max: 700 },
            stretch: { min: 75, max: 125 },
            style: { kind: 'italic' },
          },
        ],
      }],
      compositions: [{
        key: 'body',
        name: 'Body',
        members: [
          { familyKey: 'brand', ranges: [{ start: 65, end: 122 }] },
          { familyKey: 'fallback' },
        ],
      }],
    })
  })

  it('normalizes Unicode ranges and excludes surrogate code points', () => {
    expect(normalizeUnicodeRanges([
      { start: 0xe000, end: 0xe010 },
      { start: 0xd7ff, end: 0xe001 },
      { start: 0x41, end: 0x5a },
      { start: 0x5b, end: 0x7a },
    ])).toEqual([
      { start: 0x41, end: 0x7a },
      { start: 0xd7ff, end: 0xd7ff },
      { start: 0xe000, end: 0xe010 },
    ])
    expect(normalizeUnicodeRanges([])).toBeNull()
    expect(normalizeUnicodeRanges([{ start: -1, end: 1 }])).toBeNull()
  })

  it('keeps a usable projection while ignoring damaged entries and duplicate Keys', () => {
    expect(parseProjectFontRegistry({
      families: [
        { key: 'brand', name: 'Brand', faces: [{ source: 'fonts/Brand.ttf' }] },
        { key: 'broken', name: 'Broken', faces: [{ source: '../Broken.ttf' }] },
        { key: 'BRAND', name: 'Duplicate', faces: [] },
      ],
      compositions: [
        { key: 'body', name: 'Body', members: [{ familyKey: 'brand' }, { familyKey: '?' }] },
        { key: 'BRAND', name: 'Conflict', members: [] },
      ],
    })).toEqual({
      families: [{
        key: 'brand', name: 'Brand', faces: [{
          source: 'fonts/Brand.ttf',
          weight: { min: 400, max: 400 },
          stretch: { min: 100, max: 100 },
          style: { kind: 'normal' },
        }],
      }, { key: 'broken', name: 'Broken', faces: [] }],
      compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'brand' }] }],
    })
  })

  it('ignores unknown fields and rejects invalid top-level values', () => {
    expect(parseProjectFontRegistry({})).toEqual({})
    expect(parseProjectFontRegistry({ fonts: [] })).toEqual({})
    expect(parseProjectFontRegistry({ unrelated: [] })).toEqual({})
    expect(parseProjectFontRegistry({ families: {} })).toBeNull()
    expect(parseProjectFontRegistryText('{broken')).toBeNull()
    expect(JSON.parse(serializeProjectFontRegistry({}))).toEqual({})
  })

  it('keeps face sources inside the managed fonts directory', () => {
    const parsed = parseProjectFontRegistry({
      families: [{
        key: 'unsafe',
        name: 'Unsafe',
        faces: [
          { source: 'fonts/../Escape.ttf' },
          { source: 'fonts/nested/Good.ttf' },
          { source: 'fonts/C:/Bad.ttf' },
        ],
      }],
    })
    expect(parsed?.families?.[0]?.faces.map(face => face.source)).toEqual(['fonts/nested/Good.ttf'])
  })

  it('detects ambiguous face descriptor overlap within a family', () => {
    const base = {
      source: 'fonts/A.ttf',
      stretch: { min: 100, max: 100 },
      style: { kind: 'normal' as const },
    }
    expect(findOverlappingProjectFontFaces([
      { ...base, weight: { min: 300, max: 600 } },
      { ...base, source: 'fonts/B.ttf', weight: { min: 600, max: 900 } },
      { ...base, source: 'fonts/C.ttf', weight: { min: 700, max: 800 } },
    ])).toEqual([[0, 1], [1, 2]])
  })
})
