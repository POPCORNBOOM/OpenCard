import { strFromU8, strToU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { RESOURCE_PACKAGE_MANIFEST_FILE_NAME, type ResourcePackageManifest } from '../model/resourcePackage'
import { PROJECT_FONT_REGISTRY_FILE_NAME, PROJECT_ICON_REGISTRY_FILE_NAME, PROJECT_PROFILE_FILE_NAME } from '../model/projectStructure'
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

  has(path: string): boolean { return this.values.has(path) }
}

function fontRegistry() {
  return {
    families: [
      { key: 'latin', name: 'Latin', files: { normal: { upright: 'support@fonts/shared.ttf' } } },
      { key: 'cjk', name: 'CJK', files: { normal: { upright: 'support@fonts/shared.ttf' }, bold: { upright: '.opencard/fonts/cjk-bold.otf' } } },
      { key: 'unused', name: 'Unused', files: { normal: { upright: '.opencard/fonts/unused.ttf' } } },
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
        key: 'status', name: 'Status',
        icons: [{ iconKey: 'ok', name: 'OK', source: 'support@icons/ok.svg', tint: 'theme' }],
      },
      {
        key: 'controls', name: 'Controls',
        icons: [
          { iconKey: 'play', name: 'Play', source: 'support@icons/play.svg', tint: 'theme' },
          { iconKey: 'pause', name: 'Pause', source: 'support@icons/pause.svg', tint: 'original', pixelated: true },
        ],
      },
      {
        key: 'unused-icons', name: 'Unused icons',
        icons: [{ iconKey: 'idle', name: 'Idle', source: '.opencard/icons/unused/idle.svg', tint: 'theme' }],
      },
    ],
  }
}

function createFileSystem(): MemoryFileSystem {
  const fs = new MemoryFileSystem()
  fs.putText(`/project/${PROJECT_FONT_REGISTRY_FILE_NAME}`, fontRegistry())
  fs.putBinary('/project/.opencard/packages/support/fonts/shared.ttf', 'shared')
  fs.putBinary('/project/.opencard/fonts/cjk-bold.otf', 'bold')
  fs.putBinary('/project/.opencard/fonts/unused.ttf', 'unused')
  fs.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, iconRegistry())
  fs.putBinary('/project/.opencard/packages/support/icons/ok.svg', 'ok-icon')
  fs.putBinary('/project/.opencard/packages/support/icons/play.svg', 'play-icon')
  fs.putBinary('/project/.opencard/packages/support/icons/pause.svg', 'pause-icon')
  fs.putBinary('/project/.opencard/icons/unused/idle.svg', 'idle-icon')
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
    expect(fonts.families[0].files.normal.upright).toBe('.opencard/fonts/shared.ttf')
    expect(fonts.compositions.map((composition: { key: string }) => composition.key)).toEqual(['body'])
    expect(archive['.opencard/fonts/shared.ttf']).toBeDefined()
    expect(archive['.opencard/fonts/cjk-bold.otf']).toBeDefined()
    expect(archive['.opencard/fonts/unused.ttf']).toBeUndefined()
  })

  it('omits fonts.json when no font is selected and preserves a selected image', async () => {
    const fs = createFileSystem()
    fs.putBinary('/project/images/card.png', 'image')
    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      imageSelection: { paths: ['images/card.png'] },
    })
    const archive = unzipSync(result.archive)
    expect(archive[PROJECT_FONT_REGISTRY_FILE_NAME]).toBeUndefined()
    expect(archive[PROJECT_ICON_REGISTRY_FILE_NAME]).toBeUndefined()
    expect(archive['images/card.png']).toBeDefined()
  })

  it('fails before creating an archive when a selected font file is missing', async () => {
    const fs = createFileSystem()
    const registry = fontRegistry()
    registry.families[0]!.files.normal!.upright = 'support@fonts/missing.ttf'
    fs.putText(`/project/${PROJECT_FONT_REGISTRY_FILE_NAME}`, registry)
    await expect(buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
    })).rejects.toThrow('Project font file is missing: support@fonts/missing.ttf')
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

describe('buildResourcePackageFromProject images', () => {
  it('keeps selected project paths, deduplicates case-insensitively, and does not publish images', async () => {
    const fs = createFileSystem()
    fs.putBinary('/project/images/card.png', 'card')
    fs.putBinary('/project/images/nested/banner.svg', 'banner')
    fs.putBinary('/project/images/unused.webp', 'unused')
    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      imageSelection: { paths: ['images/card.png', 'IMAGES/CARD.PNG', '/project/images/nested/banner.svg'] },
      fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
      iconSelection: { seriesKeys: ['status'] },
    })
    const archive = unzipSync(result.archive)

    expect(result.imagePaths).toEqual(['/project/images/card.png', '/project/images/nested/banner.svg'])
    expect(archive['images/card.png']).toBeDefined()
    expect(archive['images/nested/banner.svg']).toBeDefined()
    expect(archive['images/unused.webp']).toBeUndefined()
    expect(archive[PROJECT_FONT_REGISTRY_FILE_NAME]).toBeDefined()
    expect(archive[PROJECT_ICON_REGISTRY_FILE_NAME]).toBeDefined()
  })

  it('rejects missing, non-image, internal, outside, and unsafe image paths before writing', async () => {
    const invalidSelections: readonly [string, string][] = [
      ['images/missing.png', 'Selected project image is missing: images/missing.png'],
      ['documents/readme.txt', 'Selected project file is not an image'],
      ['.opencard/icons/source.png', 'Selected image path is managed or internal'],
      ['.git/logo.png', 'Selected image path is managed or internal'],
      ['/outside/image.png', 'Selected image path is outside the project or unsafe'],
      ['../outside.png', 'Selected image path is outside the project or unsafe'],
      ['C:outside.png', 'Selected image path is outside the project or unsafe'],
    ]
    for (const [path, message] of invalidSelections) {
      const fs = createFileSystem()
      await expect(buildResourcePackageFromProject({
        fs,
        projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
        imageSelection: { paths: [path] },
        outputPath: '/output/theme.ocpack',
      })).rejects.toThrow(message)
      expect(fs.has('/output/theme.ocpack')).toBe(false)
    }
  })
})

describe('buildResourcePackageFromProject cover', () => {
  it('carries the project cover file and manifest field into the package', async () => {
    const fs = createFileSystem()
    fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, { name: 'Demo', cover: 'assets/cover.png' })
    fs.putBinary('/project/assets/cover.png', 'cover-bytes')

    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest

    expect(manifest.cover).toBe('assets/cover.png')
    expect(strFromU8(archive['assets/cover.png']!)).toBe('cover-bytes')
  })

  it('carries a managed .opencard cover slot without going through image selection', async () => {
    const fs = createFileSystem()
    fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, { cover: '.opencard/cover.webp' })
    fs.putBinary('/project/.opencard/cover.webp', 'slot-bytes')

    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest

    expect(manifest.cover).toBe('.opencard/cover.webp')
    expect(strFromU8(archive['.opencard/cover.webp']!)).toBe('slot-bytes')
  })

  it('carries a vector cover into the package', async () => {
    const fs = createFileSystem()
    fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, { name: 'Demo', cover: 'assets/cover.svg' })
    fs.putBinary('/project/assets/cover.svg', 'vector-cover')

    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest

    expect(manifest.cover).toBe('assets/cover.svg')
    expect(strFromU8(archive['assets/cover.svg']!)).toBe('vector-cover')
  })

  it('builds without a cover when none is declared, the file is missing, or the path is not an image', async () => {
    const cases = [
      () => createFileSystem(),
      () => {
        const fs = createFileSystem()
        fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, { cover: 'assets/missing.png' })
        return fs
      },
      () => {
        const fs = createFileSystem()
        fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, '{broken')
        return fs
      },
      () => {
        const fs = createFileSystem()
        fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, { cover: 'documents/readme.txt' })
        fs.putBinary('/project/documents/readme.txt', 'text')
        return fs
      },
    ]
    for (const createFs of cases) {
      const fs = createFs()
      const result = await buildResourcePackageFromProject({
        fs,
        projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
        fontSelection: { familyKeys: ['latin'], compositionKeys: [] },
      })
      const archive = unzipSync(result.archive)
      const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest
      expect(manifest.cover).toBeUndefined()
    }
  })

  it('does not duplicate a cover that is also selected as a package image', async () => {
    const fs = createFileSystem()
    fs.putText(`/project/${PROJECT_PROFILE_FILE_NAME}`, { cover: 'images/card.png' })
    fs.putBinary('/project/images/card.png', 'card')

    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      imageSelection: { paths: ['images/card.png'] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest

    expect(manifest.cover).toBe('images/card.png')
    // 重复路径会让归档构建直接失败，因此成功构建本身即证明封面与所选图片只写入一次。
    expect(strFromU8(archive['images/card.png']!)).toBe('card')
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
    // Each icon ships its own file, rewritten to a flat package path.
    expect(icons.iconSeries.map((series: { icons: { source: string }[] }) => series.icons.map(icon => icon.source)))
      .toEqual([
        ['.opencard/icons/ok.svg'],
        ['.opencard/icons/play.svg', '.opencard/icons/pause.svg'],
      ])
    expect(icons.iconSeries[1].icons[1]).toMatchObject({ iconKey: 'pause', tint: 'original', pixelated: true })
    expect(strFromU8(archive['.opencard/icons/ok.svg']!)).toBe('ok-icon')
    expect(strFromU8(archive['.opencard/icons/pause.svg']!)).toBe('pause-icon')
    expect(archive['.opencard/icons/idle.svg']).toBeUndefined()
  })

  it('rejects unavailable series, invalid registries, and missing icon files', async () => {
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
    registry.iconSeries[0]!.icons[0]!.source = 'support@icons/missing.svg'
    missing.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, registry)
    await expect(buildResourcePackageFromProject({
      fs: missing,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['status'] },
    })).rejects.toThrow('Project icon file is missing: support@icons/missing.svg')
  })

  it('packages every icon file of a set that spans project folders and reports its count', async () => {
    const fs = createFileSystem()
    fs.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, {
      iconSeries: [{
        key: 'outline', name: 'Outline',
        icons: [
          { iconKey: 'warn', name: 'Warn', source: '.opencard/icons/warn.svg', tint: 'theme' },
          { iconKey: 'logo', name: 'Logo', source: 'support@icons/logo.svg', tint: 'original' },
        ],
      }],
    })
    fs.putBinary('/project/.opencard/icons/warn.svg', 'warn-svg')
    fs.putBinary('/project/.opencard/packages/support/icons/logo.svg', 'logo-svg')

    const result = await buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['outline'] },
    })
    const archive = unzipSync(result.archive)
    const manifest = JSON.parse(strFromU8(archive[RESOURCE_PACKAGE_MANIFEST_FILE_NAME]!)) as ResourcePackageManifest
    const icons = JSON.parse(strFromU8(archive[PROJECT_ICON_REGISTRY_FILE_NAME]!))

    expect(manifest.public.iconSeries).toEqual([{ key: 'outline', title: 'Outline', count: 2 }])
    expect(icons.iconSeries[0].key).toBe('outline')
    expect(icons.iconSeries[0].icons.map((icon: { source: string }) => icon.source))
      .toEqual(['.opencard/icons/warn.svg', '.opencard/icons/logo.svg'])
    expect(strFromU8(archive['.opencard/icons/warn.svg']!)).toBe('warn-svg')
    expect(strFromU8(archive['.opencard/icons/logo.svg']!)).toBe('logo-svg')
  })

  it('rejects a series whose icon file is missing', async () => {
    const fs = createFileSystem()
    fs.putText(`/project/${PROJECT_ICON_REGISTRY_FILE_NAME}`, {
      iconSeries: [{
        key: 'outline', name: 'Outline',
        icons: [{ iconKey: 'warn', name: 'Warn', source: '.opencard/icons/warn.svg', tint: 'theme' }],
      }],
    })
    await expect(buildResourcePackageFromProject({
      fs,
      projectRootPath: '/project', key: 'theme', name: 'Theme', version: '1.0.0',
      iconSelection: { seriesKeys: ['outline'] },
    })).rejects.toThrow('Project icon file is missing: .opencard/icons/warn.svg')
  })
})
