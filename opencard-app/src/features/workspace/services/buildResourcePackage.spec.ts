import { strFromU8, strToU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { RESOURCE_PACKAGE_MANIFEST_FILE_NAME, type ResourcePackageManifest } from '../model/resourcePackage'
import { PROJECT_FONT_REGISTRY_FILE_NAME } from '../model/projectStructure'
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

function createFileSystem(): MemoryFileSystem {
  const fs = new MemoryFileSystem()
  fs.putText(`/project/${PROJECT_FONT_REGISTRY_FILE_NAME}`, fontRegistry())
  fs.putBinary('/project/.opencard/fonts/shared.ttf', 'shared')
  fs.putBinary('/project/.opencard/fonts/cjk-bold.otf', 'bold')
  fs.putBinary('/project/.opencard/fonts/unused.ttf', 'unused')
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

    expect(manifest.public.fonts).toEqual([
      { key: 'latin', title: 'Latin' },
      { key: 'cjk', title: 'CJK' },
      { key: 'body', title: 'Body' },
    ])
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
