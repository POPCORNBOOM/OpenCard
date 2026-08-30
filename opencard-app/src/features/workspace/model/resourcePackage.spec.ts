import { describe, expect, it } from 'vitest'
import { normalizeResourcePackageManifest } from './resourcePackage'

function manifest(publicFonts: unknown) {
  return {
    type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0',
    contentHash: '0'.repeat(64), public: { fonts: publicFonts, iconSeries: [], assets: [] }, dependencies: [],
  }
}

describe('resource package manifest public fonts', () => {
  it('normalizes key and title objects and rejects the removed string shape', () => {
    const normalized = normalizeResourcePackageManifest(manifest([
      { key: 'body', title: ' Body ' },
      { key: 'BODY', title: 'Duplicate' },
      'legacy-font',
      { key: 'heading', title: '' },
    ]))

    expect(normalized.manifest.public.fonts).toEqual([{ key: 'body', title: 'Body' }])
    expect(normalized.issues.map(issue => issue.path)).toEqual([
      'public.fonts[1].key',
      'public.fonts[2]',
      'public.fonts[3]',
    ])
  })

  it('defaults a missing public font index to an empty list', () => {
    const value = manifest(undefined)
    expect(normalizeResourcePackageManifest(value).manifest.public.fonts).toEqual([])
  })
})
