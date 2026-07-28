import { describe, expect, it } from 'vitest'
import {
  buildFontCatalog,
  createProjectFontRegistration,
  fromCssFontFamily,
  toCssFontFamily,
} from './projectFonts'

describe('project font catalog', () => {
  it('uses stable project references and CSS-safe family names', () => {
    const catalog = buildFontCatalog({
      'brand-sans': {
        family: 'Brand Sans',
        faces: [{ source: 'assets/fonts/BrandSans.woff2' }],
      },
    })

    expect(catalog[0]).toMatchObject({
      value: 'project:brand-sans',
      label: 'Brand Sans',
      source: 'project',
    })
    expect(toCssFontFamily('project:brand-sans')).toBe('"project:brand-sans"')
    expect(fromCssFontFamily('"project:brand-sans"')).toBe('project:brand-sans')
    expect(toCssFontFamily('Arial')).toBe('Arial')
  })

  it('infers editable registration metadata from imported file names', () => {
    expect(createProjectFontRegistration('assets/fonts/BrandSans-SemiBoldItalic.woff2', {})).toEqual({
      id: 'brand-sans',
      definition: {
        family: 'Brand Sans',
        faces: [{
          source: 'assets/fonts/BrandSans-SemiBoldItalic.woff2',
          weight: '600',
          style: 'italic',
        }],
      },
    })
    expect(createProjectFontRegistration('assets/fonts/思源黑体.ttf', {
      font: { family: 'Existing', faces: [{ source: 'existing.ttf' }] },
    }).id).toBe('font-2')
  })
})
