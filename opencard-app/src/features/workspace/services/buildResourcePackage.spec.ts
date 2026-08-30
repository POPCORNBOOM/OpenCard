import { strFromU8, strToU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { RESOURCE_PACKAGE_MANIFEST_FILE_NAME, type ResourcePackageManifest } from '../model/resourcePackage'
import { PROJECT_FONT_REGISTRY_FILE_NAME, PROJECT_ICON_REGISTRY_FILE_NAME } from '../model/projectStructure'
import type { FileSystemService } from './fileSystemService'
import { buildResourcePackageFromProject } from './buildResourcePackage'

class MemoryFileSystem implements Pick<FileSystemService,
  'readBinaryFile' | 'readFile' | 'fileExists' | 'writeBinaryFile'
> {
  private readonly values = new Map<string, string | Uint8Array>()

  putText(path: string, value: unknown): void {
    this.values.set(path, typeof value === 'string' ? value : JSON.stringify(value))
  }

  putBinary(path: string, value: string): void {
    this.values.set(path, strToU8(value))
  }

  async fileExists(path: string): Promise<boolean> { return this.values.has(path) }
  async readFile(path: string): Promise<string> {
    const value = this.values.get(path)
    if (typeof value !== 'string') throw new Error(`Missing text file: ${path}`)
    return value
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    const value = this.values.get(path)
    if (!value || typeof value === 'string') throw new Error(`Missing binary file: ${path}`)
    return new Uint8Array(value)
  }
  async writeBinaryFile(path: string, value: Uint8Array): Promise<void> {
    this.values.set(path, new Uint8Array(value))
  }
}

function fontRegistry() {
  return {
    families: [
      { key: 'latin', name: 'Latin', files: { normal: { upright: 'fonts/shared.ttf' } } },
      { key: 'cjk', name: 'CJK', files: { normal: { upright: 'fonts/shared.ttf' }, bold: { upright: 'fonts/cjk-bold.otf' } } },
      { key: 'unused', name: 'Unused', files: { normal: { upright: 'fonts/unused.ttf' } } },
    ],
    compositions: [
      { key: 'body', name: 'Body', members: [{ fontKey: 'latin' }, { fontKey: 'cjk' }] },
      { key: 'unused-set', name: 'Unused set', members: [{ fontKey: 'unused' }] },
    ],
  }
}

function iconRegistry() {
  return {
    iconSeries: [
      {
        key: 'status', name: 'Status', source: 'icons/shared.png',
        grid: { snapToGrid: true, rows: 2, columns: 2, pixelated: true },
        icons: [{ iconKey: 'ok', name: 'OK', x: 0, y: 0, width: 8, height: 8 }],
      },
      {
        key: 'controls', name: 'Controls', source: 'icons/shared.png',
        icons: [
          { iconKey: 'play', name: 'Play', x: 8, y: 0, width: 8, height: 8 },
          { iconKey: 'pause', name: 'Pause', x: 16, y: 0, width: 8, height: 8 },
        ],
      },
      { key: 'unused-icons', name: 'Unused icons', source: 'icons/unused.png', icons: [] },
    ],
  }
}

function createFileSystem(): MemoryFileSystem {
  const fs = new MemoryFileSystem()
  fs.putText(`/project/${PROJECT_FONT_REGISTRY_FILE_NAME}`, fontRegistry())
  fs.putBinary('/project/.opencard/fonts/shared.ttf', 'shared')
  fs.putBinary('/project/.opencard/fonts/cjk-bold.otf', 'bold')
  fs.putBinary('/project/.opencard/fonts/unused.ttf', 'unused')
  fs.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, iconRegistry())
  fs.putBinary('/project/.opencard/icons/shared.png', 'shared-icons')
  fs.putBinary('/project/.opencard/icons/unused.png', 'unused-icons')
  return fs
}

describe('buildResourcePackageFromProject fonts', () => {
  it('projects a composition, its member fonts, public index, and unique files', async () => {
    const result = await buildResourcePackageFromProject({
      fs: createFileSystem(),
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: [], compositionKeys: ['body'] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest
    const fonts = JSON.parse(strFromU8(archive[PROJECT_FONT_REGISTRY_FILE_NAME]!))

    expect(manifest.public.fonts).toEqual([{ key: 'body', title: 'Body' }])
    expect(fonts.families.map((font: { key: string }) => font.key)).toEqual(['latin', 'cjk'])
    expect(fonts.compositions.map((composition: { key: string }) => composition.key)).toEqual(['body'])
    expect(archive['.opencard/fonts/shared.ttf']).toBeDefined()
    expect(archive['.opencard/fonts/cjk-bold.otf']).toBeDefined()
    expect(archive['.opencard/fonts/unused.ttf']).toBeUndefined()
  })

  it('omits fonts.json when no font is selected and preserves other resources', async () => {
    const fs = createFileSystem()
    fs.putBinary('/project/images/card.png', 'image')
    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      resourcePaths: ['images/card.png'],
    })
    const archive = unzipSync(result.archive)
    expect(archive[PROJECT_FONT_REGISTRY_FILE_NAME]).toBeUndefined()
    expect(archive[PROJECT_ICON_REGISTRY_FILE_NAME]).toBeUndefined()
    expect(archive['images/card.png']).toBeDefined()
  })

  it('fails before creating an archive when a selected font file is missing', async () => {
    const fs = createFileSystem()
    const registry = fontRegistry()
    registry.families[0]!.files.normal!.upright = 'fonts/missing.ttf'
    fs.putText(`/project/${PROJECT_FONT_REGISTRY_FILE_NAME}`, registry)
    await expect(buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
    })).rejects.toThrow('Project font file is missing: fonts/missing.ttf')
  })

  it('rejects unavailable selections and composition members', async () => {
    await expect(buildResourcePackageFromProject({
      fs: createFileSystem(),
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: ['missing'], compositionKeys: [] },
    })).rejects.toThrow('Selected project font is unavailable: missing')

    const fs = createFileSystem()
    const registry = fontRegistry()
    registry.compositions[0]!.members = [{ fontKey: 'missing' }]
    fs.putText(`/project/${PROJECT_FONT_REGISTRY_FILE_NAME}`, registry)
    await expect(buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: [], compositionKeys: ['body'] },
    })).rejects.toThrow('Font composition body references unavailable project font: missing')
  })
})

describe('buildResourcePackageFromProject icons', () => {
  it('projects selected series, public summaries, and a shared spritesheet once', async () => {
    const result = await buildResourcePackageFromProject({
      fs: createFileSystem(),
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['status', 'controls'] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest
    const icons = JSON.parse(strFromU8(archive[PROJECT_ICON_REGISTRY_FILE_NAME]!))

    expect(manifest.public.iconSeries).toEqual([
      { key: 'status', title: 'Status', count: 1 },
      { key: 'controls', title: 'Controls', count: 2 },
    ])
    expect(icons.iconSeries.map((series: { key: string }) => series.key)).toEqual(['status', 'controls'])
    expect(icons.iconSeries[0].grid).toEqual({ snapToGrid: true, rows: 2, columns: 2, pixelated: true })
    expect(archive['.opencard/icons/shared.png']).toBeDefined()
    expect(archive['.opencard/icons/unused.png']).toBeUndefined()
  })

  it('rejects unavailable series, invalid registries, and missing spritesheets', async () => {
    await expect(buildResourcePackageFromProject({
      fs: createFileSystem(),
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['missing'] },
    })).rejects.toThrow('Selected project icon series is unavailable: missing')

    const invalid = createFileSystem()
    invalid.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, '{broken')
    await expect(buildResourcePackageFromProject({
      fs: invalid,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['status'] },
    })).rejects.toThrow('Project icon registry is invalid')

    const missing = createFileSystem()
    const registry = iconRegistry()
    registry.iconSeries[0]!.source = 'icons/missing.png'
    missing.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, registry)
    await expect(buildResourcePackageFromProject({
      fs: missing,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['status'] },
    })).rejects.toThrow('Project icon spritesheet is missing: icons/missing.png')
  })
})
