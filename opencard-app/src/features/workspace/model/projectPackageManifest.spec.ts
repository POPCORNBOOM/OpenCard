import { describe, expect, it } from 'vitest'
import {
  normalizeProjectPackageManifest,
  reconcileProjectPackageManifest,
  serializeProjectPackageManifest,
} from './projectPackageManifest'
import type { ResourcePackageManifest } from './resourcePackage'

const hash = 'a'.repeat(64)
const packageManifest = { type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.2.0', contentHash: hash, public: { fonts: [], iconSeries: [] } } satisfies ResourcePackageManifest

describe('project package manifest', () => {
  it('stores one complete manifest per package Key', () => {
    const result = normalizeProjectPackageManifest({ type: 'opencard-project-packages', packages: { theme: packageManifest } })
    expect(result.issues).toEqual([])
    expect(result.manifest.packages.theme).toEqual(packageManifest)
    expect(JSON.parse(serializeProjectPackageManifest(result.manifest)).packages).toEqual({ theme: packageManifest })
  })

  it('does not retain the old requirement-array shape', () => {
    const result = normalizeProjectPackageManifest({ packages: [{ key: 'theme', version: '1.2.0' }] })
    expect(result.manifest.packages).toEqual({})
    expect(result.issues).not.toHaveLength(0)
  })

  it('reconciles the persisted index with installed package directories', () => {
    const current = normalizeProjectPackageManifest({
      type: 'opencard-project-packages',
      packages: { theme: packageManifest, removed: { ...packageManifest, key: 'removed' } },
    }).manifest
    const added = { ...packageManifest, key: 'added', name: 'Added' } satisfies ResourcePackageManifest

    expect(reconcileProjectPackageManifest(current, new Map([
      ['theme', null],
      ['added', added],
    ]))).toEqual({
      type: 'opencard-project-packages',
      packages: { theme: packageManifest, added },
    })
  })
})
