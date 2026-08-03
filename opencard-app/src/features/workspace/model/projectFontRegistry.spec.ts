import { describe, expect, it } from 'vitest'
import {
  parseProjectFontRegistry,
  parseProjectFontRegistryText,
  serializeProjectFontRegistry,
} from './projectFontRegistry'

describe('project font registry', () => {
  it('normalizes registered fonts and ignores unknown document fields', () => {
    expect(parseProjectFontRegistry({
      schemaVersion: 1,
      fonts: {
        brand: { name: ' Brand ', source: 'assets\\fonts\\Brand.woff2' },
      },
    })).toEqual({
      fonts: { brand: { name: 'Brand', source: 'assets/fonts/Brand.woff2' } },
    })
  })

  it('rejects malformed entries and case-insensitive key conflicts', () => {
    expect(parseProjectFontRegistry({ fonts: { unsafe: { name: 'Unsafe', source: '../Unsafe.ttf' } } })).toBeNull()
    expect(parseProjectFontRegistry({
      fonts: {
        brand: { name: 'Brand', source: 'brand.ttf' },
        BRAND: { name: 'Brand 2', source: 'brand-2.ttf' },
      },
    })).toBeNull()
  })

  it('uses an empty canonical document and rejects invalid JSON', () => {
    expect(JSON.parse(serializeProjectFontRegistry({ fonts: {} }))).toEqual({})
    expect(parseProjectFontRegistryText('{broken')).toBeNull()
  })
})
