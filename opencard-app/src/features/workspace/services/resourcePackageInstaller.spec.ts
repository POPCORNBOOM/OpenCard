import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decideResourcePackageInstallation, installResourcePackage, previewResourcePackage } from './resourcePackageInstaller'
import type { ResourcePackageManifest } from '../model/resourcePackage'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }))

const hash = 'a'.repeat(64)
const manifest = { type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0', contentHash: hash, public: { fonts: [], iconSeries: [] } } satisfies ResourcePackageManifest

function native(overrides: Record<string, unknown> = {}) {
  return { manifestJson: JSON.stringify(manifest), contentHash: hash, existingManifestJson: null, existingFingerprint: null, entryCount: 1, unpackedBytes: 100, packageKey: 'theme', entryPaths: [], fontsJson: null, iconsJson: null, ...overrides }
}

describe('resourcePackageInstaller', () => {
  beforeEach(() => invoke.mockReset())

  it('only asks for replacement when the same Key has a different version', () => {
    expect(decideResourcePackageInstallation(manifest, null)).toBe('install')
    expect(decideResourcePackageInstallation(manifest, manifest)).toBe('unchanged')
    expect(decideResourcePackageInstallation({ ...manifest, version: '2.0.0' }, manifest)).toBe('replace')
  })

  it('projects a native archive inspection without exposing archive bytes', async () => {
    invoke.mockResolvedValueOnce(native())
    const result = await previewResourcePackage({ projectRootPath: 'D:/project', sourcePath: 'D:/theme.ocpack' })
    expect(result.manifest).toEqual(manifest)
    expect(result).not.toHaveProperty('files')
    expect(invoke).toHaveBeenCalledWith('inspect_resource_package', { request: { projectRootPath: 'D:/project', sourcePath: 'D:/theme.ocpack' } })
  })

  it('rejects an archive whose native content hash differs from the manifest', async () => {
    invoke.mockResolvedValueOnce(native({ contentHash: 'b'.repeat(64) }))
    await expect(previewResourcePackage({ projectRootPath: 'D:/project', sourcePath: 'D:/theme.ocpack' })).rejects.toThrow('content hash')
  })

  it('commits only the inspected source and fingerprints', async () => {
    invoke.mockResolvedValueOnce(native())
    const preview = await previewResourcePackage({ projectRootPath: 'D:/project', sourcePath: 'D:/theme.ocpack' })
    invoke.mockResolvedValueOnce({ targetPath: 'D:/project/.opencard/packages/theme', replaced: false, fingerprint: 'f' })
    const result = await installResourcePackage({ preview })
    expect(result.unchanged).toBe(false)
    expect(invoke.mock.calls[1][1].request).toMatchObject({ expectedContentHash: hash, expectedExistingFingerprint: null })
  })
})
