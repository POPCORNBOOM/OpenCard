import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import {
  createProjectIconPackManifest,
  exportProjectIconPack,
  parseProjectIconPackManifest,
  projectIconPackArchivePath,
  readProjectIconPack,
} from './projectIconPack'

const series = {
  name: 'Outline icons',
  key: 'outline',
  icons: [
    { iconKey: 'warn', name: 'Warn', source: '.opencard/icons/outline/warn.svg', tint: 'theme' as const },
    { iconKey: 'coin', name: 'Coin', source: '.opencard/icons/outline/coin.png', tint: 'original' as const, pixelated: true },
    { iconKey: 'wide', name: 'Wide', source: '.opencard/icons/outline/wide.svg', tint: 'theme' as const, rotation: 90 as const },
  ],
}

const bytesByPath: Readonly<Record<string, Uint8Array>> = {
  '/project/.opencard/icons/outline/warn.svg': new Uint8Array([1, 2]),
  '/project/.opencard/icons/outline/coin.png': new Uint8Array([3, 4]),
  '/project/.opencard/icons/outline/wide.svg': new Uint8Array([5, 6]),
}
const resolveSourcePath = (source: string) => `/project/${source}`

async function exportFixture() {
  let archive: Uint8Array | undefined
  const fs = {
    readBinaryFile: vi.fn(async (path: string) => bytesByPath[path]!),
    writeBinaryFile: vi.fn(async (_path: string, bytes: Uint8Array) => { archive = bytes }),
  }
  const written = await exportProjectIconPack({ fs, series, resolveSourcePath, outputPath: 'D:/Exports/outline' })
  return { archive: archive!, written, fs }
}

describe('projectIconPack', () => {
  it('derives the archive path from the icon Key and its original extension', () => {
    expect(projectIconPackArchivePath({ iconKey: 'warn', name: '', source: 'a/b/warn.svg', tint: 'theme' }))
      .toBe('icons/warn.svg')
    expect(projectIconPackArchivePath({ iconKey: 'coin', name: '', source: 'a/b/coin.PNG', tint: 'original' }))
      .toBe('icons/coin.png')
    expect(() => projectIconPackArchivePath({ iconKey: 'x', name: '', source: 'a/b/x.txt', tint: 'theme' }))
      .toThrow('Unsupported icon pack source')
  })

  it('exports one manifest plus one file per icon and reads them back', async () => {
    const { archive, written } = await exportFixture()
    expect(written).toBe('D:/Exports/outline.ociconpack')

    const files = unzipSync(archive)
    expect(Object.keys(files).sort()).toEqual([
      'iconpack.json', 'icons/coin.png', 'icons/warn.svg', 'icons/wide.svg',
    ])
    expect(JSON.parse(strFromU8(files['iconpack.json']!))).toMatchObject({
      type: 'opencard-icon-pack',
      schemaVersion: '1',
      name: 'Outline icons',
      key: 'outline',
      icons: [
        { iconKey: 'warn', name: 'Warn', source: 'icons/warn.svg', tint: 'theme' },
        { iconKey: 'coin', name: 'Coin', source: 'icons/coin.png', tint: 'original', pixelated: true },
        { iconKey: 'wide', name: 'Wide', source: 'icons/wide.svg', tint: 'theme', rotation: 90 },
      ],
    })

    const read = await readProjectIconPack({ readBinaryFile: async () => archive }, 'outline.ociconpack')
    expect(read.manifest.key).toBe('outline')
    expect([...read.iconSources.keys()].sort()).toEqual(['icons/coin.png', 'icons/warn.svg', 'icons/wide.svg'])
    expect(read.iconSources.get('icons/coin.png')).toEqual(new Uint8Array([3, 4]))
  })

  it('appends the pack extension only when it is missing', async () => {
    const fs = {
      readBinaryFile: async () => new Uint8Array([1]),
      writeBinaryFile: vi.fn(async () => undefined),
    }
    await expect(exportProjectIconPack({
      fs, series: { name: 'S', key: 's', icons: [{ iconKey: 'a', name: 'A', source: 'a.svg', tint: 'theme' }] },
      resolveSourcePath: () => 'a.svg', outputPath: 'D:/out.OCICONPACK',
    })).resolves.toBe('D:/out.OCICONPACK')
  })

  it('refuses a manifest whose icons collide on the same archive path', () => {
    const archivePaths = new Map([['a.svg', 'icons/a.svg']])
    expect(() => createProjectIconPackManifest(
      { name: 'S', key: 's', icons: [{ iconKey: 'a', name: 'A', source: 'b.svg', tint: 'theme' }] },
      archivePaths,
    )).toThrow("missing an archive path for 'b.svg'")
  })

  it('rejects a pack that omits a file it declares', async () => {
    const archive = zipSync({
      'iconpack.json': strToU8(JSON.stringify({
        type: 'opencard-icon-pack', schemaVersion: '1', name: 'Outline', key: 'outline',
        icons: [
          { iconKey: 'warn', name: 'Warn', source: 'icons/warn.svg', tint: 'theme' },
          { iconKey: 'logo', name: 'Logo', source: 'icons/logo.svg', tint: 'original' },
        ],
      })),
      'icons/warn.svg': new Uint8Array([1]),
    })
    await expect(readProjectIconPack({ readBinaryFile: async () => archive }, 'pack.ociconpack'))
      .rejects.toThrow("missing 'icons/logo.svg'")
  })

  it('rejects a pack that carries a file it never declares', async () => {
    const archive = zipSync({
      'iconpack.json': strToU8(JSON.stringify({
        type: 'opencard-icon-pack', schemaVersion: '1', name: 'Outline', key: 'outline',
        icons: [{ iconKey: 'warn', name: 'Warn', source: 'icons/warn.svg', tint: 'theme' }],
      })),
      'icons/warn.svg': new Uint8Array([1]),
      'icons/extra.svg': new Uint8Array([2]),
    })
    await expect(readProjectIconPack({ readBinaryFile: async () => archive }, 'pack.ociconpack'))
      .rejects.toThrow('only the icons it declares')
  })

  it('rejects an invalid or unsafe manifest', async () => {
    const manifest = {
      type: 'opencard-icon-pack', schemaVersion: '1', name: 'Outline', key: 'outline',
      icons: [{ iconKey: 'warn', name: 'Warn', source: 'icons/warn.svg', tint: 'theme' }],
    }
    expect(parseProjectIconPackManifest({ ...manifest, key: 'Not Valid' })).toBeNull()
    expect(parseProjectIconPackManifest({ ...manifest, schemaVersion: '2' })).toBeNull()
    expect(parseProjectIconPackManifest({ ...manifest, icons: [{ iconKey: 'warn', name: 'Warn', source: '../x.svg' }] })).toBeNull()
    expect(parseProjectIconPackManifest({ ...manifest, icons: [{ iconKey: 'warn', name: 'Warn', source: 'x.svg', tint: 'blue' }] })).toBeNull()

    const unsafe = zipSync({
      'iconpack.json': strToU8(JSON.stringify(manifest)),
      'icons/warn.svg': new Uint8Array([1]),
      '../escape.svg': new Uint8Array([2]),
    })
    await expect(readProjectIconPack({ readBinaryFile: async () => unsafe }, 'pack.ociconpack'))
      .rejects.toThrow('Invalid icon pack path')
  })

  it('preserves localized display text', () => {
    expect(parseProjectIconPackManifest({
      type: 'opencard-icon-pack', schemaVersion: '1', name: 'Outline', key: 'outline',
      icons: [{ iconKey: 'warn', name: 'Warn', source: 'icons/warn.svg', tint: 'theme' }],
      i18n: { name: { 'zh-CN': '轮廓图标', 'en-US': 'Outline' } },
    })).toMatchObject({ i18n: { name: { 'zh-CN': '轮廓图标' } } })
  })
})
