import { describe, expect, it } from 'vitest'
import {
  parseProjectFontRegistry,
  parseProjectFontRegistryText,
  serializeProjectFontRegistry,
} from './projectFontRegistry'

describe('project font registry', () => {
  it('normalizes independent font and font-set lists', () => {
    expect(parseProjectFontRegistry({
      fonts: [{ key: 'brand', name: ' Brand ', source: 'assets\\fonts\\Brand.woff2' }],
      fontSets: [{ key: 'body', name: ' Body ', fontKeys: ['brand'] }],
    })).toEqual({
      fonts: [{ key: 'brand', name: 'Brand', source: 'assets/fonts/Brand.woff2' }],
      fontSets: [{ key: 'body', name: 'Body', fontKeys: ['brand'] }],
    })
  })

  it('accepts empty documents but rejects unsafe sources and case-insensitive key conflicts', () => {
    expect(parseProjectFontRegistry({})).toEqual({})
    expect(parseProjectFontRegistry({ fonts: [] })).toEqual({})
    expect(parseProjectFontRegistry({
      fonts: [{ key: 'unsafe', name: 'Unsafe', source: '../Unsafe.ttf' }],
    })).toBeNull()
    expect(parseProjectFontRegistry({ fonts: [
      { key: 'brand', name: 'Brand', source: 'brand.ttf' },
      { key: 'BRAND', name: 'Brand 2', source: 'brand-2.ttf' },
    ] })).toBeNull()
    expect(parseProjectFontRegistry({
      fonts: [{ key: 'brand', name: 'Brand', source: 'brand.ttf' }],
      fontSets: [{ key: 'BRAND', name: 'Fallback', fontKeys: ['brand'] }],
    })).toBeNull()
  })

  it('ignores unknown document fields and rejects invalid JSON', () => {
    expect(parseProjectFontRegistry({ metadata: true })).toEqual({})
    expect(parseProjectFontRegistry({ fontSets: [] })).toEqual({})
    expect(parseProjectFontRegistry({
      fontSets: [{ key: 'body', name: 'Body', fontKeys: ['missing', 'nested'] }],
    })).toEqual({ fontSets: [{ key: 'body', name: 'Body', fontKeys: ['missing', 'nested'] }] })
    expect(parseProjectFontRegistryText('{broken')).toBeNull()
    expect(JSON.parse(serializeProjectFontRegistry({
      fonts: [{ key: 'brand', name: 'Brand', source: 'brand.ttf' }],
    }))).toEqual({ fonts: [{ key: 'brand', name: 'Brand', source: 'brand.ttf' }] })
    expect(JSON.parse(serializeProjectFontRegistry({}))).toEqual({})
  })
})
