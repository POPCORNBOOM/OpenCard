import { describe, expect, it } from 'vitest'
import {
  normalizeProjectPackageManifest,
  serializeProjectPackageManifest,
} from './projectPackageManifest'

describe('project package manifest', () => {
  it('stores only a required version per package Key', () => {
    const result = normalizeProjectPackageManifest({ type: 'opencard-project-packages', packages: { theme: { key: 'theme', version: '1.2.0', name: 'ignored', contentHash: 'ignored' } } })
    expect(result.issues).toEqual([])
    expect(result.manifest.packages.theme).toEqual({ version: '1.2.0' })
    expect(JSON.parse(serializeProjectPackageManifest(result.manifest)).packages.theme).toEqual(result.manifest.packages.theme)
  })

  it('does not retain the old requirement-array shape', () => {
    const result = normalizeProjectPackageManifest({ packages: [{ key: 'theme', version: '1.2.0' }] })
    expect(result.manifest.packages).toEqual({})
    expect(result.issues).not.toHaveLength(0)
  })

  it('drops package keys that are not single safe slugs', () => {
    const result = normalizeProjectPackageManifest({
      type: 'opencard-project-packages',
      packages: {
        '../outside': { version: '1.0.0' },
        'nested/key': { version: '1.0.0' },
        'Upper Case': { version: '1.0.0' },
        'github-alice-theme-a1b2c3': { version: '1.0.0' },
      },
    })

    expect(Object.keys(result.manifest.packages)).toEqual(['github-alice-theme-a1b2c3'])
    expect(result.issues.map(issue => issue.path)).toEqual([
      'packages.../outside', 'packages.nested/key', 'packages.Upper Case',
    ])
  })
})
