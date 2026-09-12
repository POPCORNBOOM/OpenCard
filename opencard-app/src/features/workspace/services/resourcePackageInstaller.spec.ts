import { beforeEach, describe, expect, it, vi } from 'vitest'
import { checkInstalledResourcePackage, decideResourcePackageInstallation, installResourcePackage, previewResourcePackage } from './resourcePackageInstaller'
import type { ResourcePackageManifest } from '../model/resourcePackage'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }))

const hash = 'a'.repeat(64)
const manifest = { type: 'opencard-resource-package', key: 'theme', name: 'Theme', version: '1.0.0', contentHash: hash, public: { fonts: [], iconSeries: [] } } satisfies ResourcePackageManifest

function native(overrides: Record<string, unknown> = {}) {
  return { manifestJson: JSON.stringify(manifest), contentHash: hash, existingManifestJson: null, existingFingerprint: null, entryCount: 1, unpackedBytes: 100, entryPaths: [], fontsJson: null, iconsJson: null, ...overrides }
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

  it('installs a remote package under the Key derived from its source instead of the archive Key', async () => {
    invoke.mockResolvedValueOnce(native())
    const preview = await previewResourcePackage({ projectRootPath: 'D:/project', sourcePath: 'D:/pkg.zip', targetKey: 'alice-my-theme' })
    expect(preview.manifest.key).toBe('alice-my-theme')
    expect(preview.targetPath).toBe('D:/project/.opencard/packages/alice-my-theme')
    expect(invoke).toHaveBeenCalledWith('inspect_resource_package', { request: { projectRootPath: 'D:/project', sourcePath: 'D:/pkg.zip', targetKey: 'alice-my-theme' } })

    invoke.mockResolvedValueOnce({ targetPath: 'D:/project/.opencard/packages/alice-my-theme', replaced: false, fingerprint: 'f' })
    await installResourcePackage({ preview })
    const request = invoke.mock.calls[1]![1].request as { targetKey: string; manifestJson: string }
    expect(request.targetKey).toBe('alice-my-theme')
    expect(JSON.parse(request.manifestJson).key).toBe('alice-my-theme')
  })

  it('checks an installed package against the declared version and manifest hash', async () => {
    invoke.mockResolvedValueOnce({
      exists: true,
      manifestJson: JSON.stringify(manifest),
      contentHash: hash,
      entryPaths: ['.opencard/manifest.json'],
      fontsJson: null,
      iconsJson: null,
    })
    await expect(checkInstalledResourcePackage({ projectRootPath: 'D:/project', packageKey: 'theme', requiredVersion: '1.0.0' })).resolves.toMatchObject({ status: 'ok' })
  })

  it('accepts an icon package that ships every declared icon file', async () => {
    invoke.mockResolvedValueOnce(native({
      entryPaths: ['.opencard/manifest.json', '.opencard/icons/warn.svg', '.opencard/icons/logo.png'],
      iconsJson: JSON.stringify({
        iconSeries: [{
          key: 'outline', name: 'Outline',
          icons: [
            { iconKey: 'warn', name: 'Warn', source: '.opencard/icons/warn.svg', tint: 'theme' },
            { iconKey: 'logo', name: 'Logo', source: '.opencard/icons/logo.png', tint: 'original' },
          ],
        }],
      }),
    }))
    await expect(previewResourcePackage({ projectRootPath: 'D:/project', sourcePath: 'D:/theme.ocpack' }))
      .resolves.toMatchObject({ manifest: expect.objectContaining({ key: 'theme' }) })
  })

  it('rejects an icon package that omits a declared icon file', async () => {
    invoke.mockResolvedValueOnce(native({
      entryPaths: ['.opencard/manifest.json', '.opencard/icons/warn.svg'],
      iconsJson: JSON.stringify({
        iconSeries: [{
          key: 'outline', name: 'Outline',
          icons: [{ iconKey: 'logo', name: 'Logo', source: '.opencard/icons/logo.png', tint: 'original' }],
        }],
      }),
    }))
    await expect(previewResourcePackage({ projectRootPath: 'D:/project', sourcePath: 'D:/theme.ocpack' }))
      .rejects.toThrow('Missing packaged icon file: .opencard/icons/logo.png')
  })
})
