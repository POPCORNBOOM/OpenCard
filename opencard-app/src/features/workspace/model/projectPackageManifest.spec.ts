import { describe, expect, it } from 'vitest'
import {
  compareProjectPackageManifest,
  normalizeProjectPackageManifest,
  projectPackageActions,
} from './projectPackageManifest'

describe('project package manifest', () => {
  it('normalizes requirements with repository paths and compares installed packages', () => {
    const manifest = normalizeProjectPackageManifest({
      packages: [{ key: 'Theme', version: '1.2.0', repositoryPath: '../theme.ocpack' }],
    }).manifest
    expect(manifest.packages).toEqual([{ key: 'theme', version: '1.2.0', repositoryPath: '../theme.ocpack' }])
    const differences = compareProjectPackageManifest(manifest, new Map([['theme', { version: '1.0.0' }], ['extra', { version: '1.0.0' }]]))
    expect(differences).toEqual([
      { kind: 'extra', key: 'extra', installedVersion: '1.0.0' },
      { kind: 'version-mismatch', key: 'theme', requestedVersion: '1.2.0', installedVersion: '1.0.0', repositoryPath: '../theme.ocpack' },
    ])
    expect(projectPackageActions(differences.find((difference) => difference.kind === 'version-mismatch')!)).toContain('update-package')
  })
})
