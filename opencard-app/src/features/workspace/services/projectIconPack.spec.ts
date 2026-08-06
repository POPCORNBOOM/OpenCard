import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import {
  exportProjectIconPack,
  parseProjectIconPackManifest,
  readProjectIconPack,
} from './projectIconPack'

const series = {
  name: 'Status icons',
  key: 'status',
  source: 'assets/icons/status.png',
  grid: { snapToGrid: true, rows: 2, columns: 4, pixelated: true },
  icons: [{ iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16, pixelated: true }],
}

describe('projectIconPack', () => {
  it('exports exactly one manifest and one spritesheet and reads them back', async () => {
    const sourceBytes = new Uint8Array([137, 80, 78, 71])
    let archive: Uint8Array | undefined
    const fs = {
      readBinaryFile: vi.fn(async () => sourceBytes),
      writeBinaryFile: vi.fn(async (_path: string, bytes: Uint8Array) => { archive = bytes }),
    }

    await expect(exportProjectIconPack({
      fs,
      series,
      spritesheetPath: 'D:/Project/assets/icons/status.png',
      outputPath: 'D:/Exports/status-icons',
    })).resolves.toBe('D:/Exports/status-icons.ociconpack')

    expect(fs.writeBinaryFile).toHaveBeenCalledWith(
      'D:/Exports/status-icons.ociconpack',
      expect.any(Uint8Array),
    )
    const files = unzipSync(archive!)
    expect(Object.keys(files).sort()).toEqual(['iconpack.json', 'spritesheet.png'])
    expect(JSON.parse(strFromU8(files['iconpack.json']!))).toMatchObject({
      type: 'opencard-icon-pack', schemaVersion: '1', name: 'Status icons', key: 'status',
      spritesheet: 'spritesheet.png', icons: series.icons,
    })

    const readFs = { readBinaryFile: vi.fn(async () => archive!) }
    await expect(readProjectIconPack(readFs, 'D:/Exports/status-icons.ociconpack')).resolves.toMatchObject({
      manifest: expect.objectContaining({ name: 'Status icons', key: 'status' }),
      spritesheetBytes: sourceBytes,
    })
  })

  it('rejects an archive with extra files or an invalid manifest', async () => {
    const manifest = JSON.stringify({
      type: 'opencard-icon-pack', schemaVersion: '1', name: 'Status icons', key: 'status',
      spritesheet: 'spritesheet.png', icons: [],
    })
    const archive = zipSync({
      'iconpack.json': strToU8(manifest),
      'spritesheet.png': new Uint8Array([1]),
      'unexpected.txt': new Uint8Array([2]),
    })
    await expect(readProjectIconPack({ readBinaryFile: async () => archive }, 'pack.ociconpack'))
      .rejects.toThrow('one manifest and one spritesheet')
    expect(parseProjectIconPackManifest({ ...JSON.parse(manifest), key: 'Not Valid' })).toBeNull()
  })
})
