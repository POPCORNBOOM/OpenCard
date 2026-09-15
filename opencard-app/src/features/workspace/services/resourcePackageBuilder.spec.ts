import { describe, expect, it } from 'vitest'
import { strToU8, unzipSync } from 'fflate'
import { buildResourcePackageArchive } from './resourcePackageBuilder'
import { RESOURCE_PACKAGE_MANIFEST_FILE_NAME } from '../model/resourcePackage'
import { createResourcePackageContentHash } from './resourcePackageHash'

function files() {
  return [
    { path: '.opencard/fonts/fonts.json', bytes: strToU8('{"families":[]}') },
    { path: 'assets/card.png', bytes: new Uint8Array([1, 2, 3]) },
  ]
}

describe('resourcePackageBuilder', () => {
  it('builds a self-contained archive with a stable manifest hash', async () => {
    const result = await buildResourcePackageArchive({
      key: 'theme', name: 'Theme', version: '1.0.0', files: files(),
    })
    expect(result.manifest.contentHash).toBe(await createResourcePackageContentHash(result.files))
    const archive = unzipSync(result.archive)
    expect(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]).toBeDefined()
    expect(archive['assets/card.png']).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('normalizes the output extension', async () => {
    const result = await buildResourcePackageArchive({
      key: 'theme', name: 'Theme', version: '1.0.0', files: [], outputPath: '/tmp/theme',
      fs: { writeBinaryFile: async () => undefined },
    })
    expect(result.outputPath).toBe('/tmp/theme.ocpack')
  })
})
