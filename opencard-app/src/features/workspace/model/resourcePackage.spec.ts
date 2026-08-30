import { describe, expect, it } from 'vitest'
import { normalizeResourcePackageManifest } from './resourcePackage'

function manifest(publicFonts: unknown, publicIconSeries: unknown = []) {
  return {
    type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0',
    contentHash: '0'.repeat(64), public: { fonts: publicFonts, iconSeries: publicIconSeries, assets: [] }, dependencies: [],
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

describe('resource package manifest public icon series', () => {
  it('normalizes summaries and rejects duplicates, invalid counts, and the removed string shape', () => {
    const normalized = normalizeResourcePackageManifest(manifest([], [
      { key: 'status', title: ' Status ', count: 3 },
      { key: 'STATUS', title: 'Duplicate', count: 1 },
      { key: 'empty', title: 'Empty', count: 0 },
      { key: 'invalid', title: 'Invalid', count: -1 },
      'legacy-series',
    ]))

    expect(normalized.manifest.public.iconSeries).toEqual([
      { key: 'status', title: 'Status', count: 3 },
      { key: 'empty', title: 'Empty', count: 0 },
    ])
    expect(normalized.issues.map(issue => issue.path)).toEqual([
      'public.iconSeries[1].key',
      'public.iconSeries[3]',
      'public.iconSeries[4]',
    ])
  })

  it('defaults a missing public icon series index to an empty list', () => {
    const value = manifest([])
    delete (value.public as Partial<typeof value.public>).iconSeries
    expect(normalizeResourcePackageManifest(value).manifest.public.iconSeries).toEqual([])
  })
})
