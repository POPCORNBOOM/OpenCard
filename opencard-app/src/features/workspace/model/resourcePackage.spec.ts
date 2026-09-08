import { describe, expect, it } from 'vitest'
import {
  normalizeResourcePackageManifest,
  resolveInstalledResourcePackageKey,
  resolveInstalledResourcePackageManifestPath,
} from './resourcePackage'

function manifest(publicFonts: unknown, publicIconSeries: unknown = []) {
  return {
    type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0',
    contentHash: '0'.repeat(64), public: { fonts: publicFonts, iconSeries: publicIconSeries },
  }
}

describe('installed package manifest paths', () => {
  it('constructs and reverses the single-Key package manifest location', () => {
    const path = resolveInstalledResourcePackageManifestPath('D:\\Cards\\Demo', 'theme')
    expect(path).toBe('D:/Cards/Demo/.opencard/packages/theme/.opencard/manifest.json')
    expect(resolveInstalledResourcePackageKey(path)).toBe('theme')
    expect(resolveInstalledResourcePackageKey('D:/Cards/Demo/.opencard/packages/group/theme/.opencard/manifest.json')).toBeNull()
  })
})

describe('package manifest public fonts', () => {
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

describe('package manifest public icon series', () => {
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
