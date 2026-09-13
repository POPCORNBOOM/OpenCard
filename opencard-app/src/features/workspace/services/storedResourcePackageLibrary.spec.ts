import { describe, expect, it, vi } from 'vitest'
import type { FileSystemService } from './fileSystemService'
import type { StoredResourcePackagePathService } from './storedResourcePackageLibrary'
import { StoredResourcePackageLibraryService } from './storedResourcePackageLibrary'

const installer = vi.hoisted(() => ({ previewResourcePackage: vi.fn() }))

vi.mock('./resourcePackageInstaller', () => ({
  previewResourcePackage: installer.previewResourcePackage,
}))

type DirectoryEntry = { name: string; isFile: boolean; isDirectory: boolean; isSymlink: boolean }

class MemoryFileSystem implements Pick<FileSystemService,
  'createDirectory' | 'readDirectory' | 'fileExists' | 'copyFile' | 'deleteFile' | 'pickFile'
> {
  readonly directories = new Set<string>()
  readonly files = new Map<string, Uint8Array>()
  readonly pickFile = vi.fn(async () => null as string | null)

  async createDirectory(path: string): Promise<void> { this.directories.add(path) }
  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path)
  }
  async readDirectory(path: string): Promise<DirectoryEntry[]> {
    if (!this.directories.has(path)) throw new Error(`Missing directory: ${path}`)
    const prefix = `${path}/`
    const names = new Set<string>()
    for (const candidate of [...this.files.keys(), ...this.directories]) {
      if (!candidate.startsWith(prefix)) continue
      const name = candidate.slice(prefix.length).split('/')[0]
      if (name) names.add(name)
    }
    return [...names].map((name) => ({
      name,
      isFile: this.files.has(`${prefix}${name}`),
      isDirectory: this.directories.has(`${prefix}${name}`),
      isSymlink: false,
    }))
  }
  async copyFile(sourcePath: string, targetPath: string): Promise<void> {
    const value = this.files.get(sourcePath)
    if (!value) throw new Error(`Missing file: ${sourcePath}`)
    this.files.set(targetPath, new Uint8Array(value))
  }
  async deleteFile(path: string): Promise<void> { this.files.delete(path) }
}

const paths: StoredResourcePackagePathService = {
  appStorageDir: async () => '/app',
  join: async (...segments: string[]) => segments.join('/'),
}

const manifest = (key: string, name: string, version: string) => ({
  manifest: { type: 'opencard-resource-package', key, name, version, contentHash: 'a'.repeat(64), public: { fonts: [], iconSeries: [] } },
})

function createLibrary(fs: MemoryFileSystem): StoredResourcePackageLibraryService {
  return new StoredResourcePackageLibraryService(fs as unknown as FileSystemService, paths)
}

describe('StoredResourcePackageLibraryService', () => {
  it('ignores files that are not add-on packages', async () => {
    const fs = new MemoryFileSystem()
    fs.directories.add('/app/packages')
    fs.files.set('/app/packages/notes.txt', new Uint8Array([1]))
    installer.previewResourcePackage.mockReset()

    const library = await createLibrary(fs).loadLibrary()

    expect(library).toEqual({ packs: [], warnings: [] })
    expect(installer.previewResourcePackage).not.toHaveBeenCalled()
  })

  it('lists add-on packages sorted by name and reports unreadable ones as warnings', async () => {
    const fs = new MemoryFileSystem()
    fs.directories.add('/app/packages')
    fs.files.set('/app/packages/zeta.ocpack', new Uint8Array([1]))
    fs.files.set('/app/packages/alpha.ocpack', new Uint8Array([3]))
    fs.files.set('/app/packages/broken.ocpack', new Uint8Array([2]))
    installer.previewResourcePackage.mockReset()
    installer.previewResourcePackage.mockImplementation(async ({ sourcePath }: { sourcePath: string }) => {
      if (sourcePath.endsWith('broken.ocpack')) throw new Error('Package manifest is invalid')
      if (sourcePath.endsWith('alpha.ocpack')) return manifest('alpha', 'Alpha Pack', '1.0.0')
      return manifest('zeta', 'Zeta Pack', '2.0.0')
    })

    const library = await createLibrary(fs).loadLibrary()

    expect(library.packs).toEqual([
      { path: '/app/packages/alpha.ocpack', key: 'alpha', name: 'Alpha Pack', version: '1.0.0' },
      { path: '/app/packages/zeta.ocpack', key: 'zeta', name: 'Zeta Pack', version: '2.0.0' },
    ])
    expect(library.warnings).toEqual([
      { path: '/app/packages/broken.ocpack', reason: 'Package manifest is invalid' },
    ])
  })

  it('validates a package before storing it and names the file after its Key', async () => {
    const fs = new MemoryFileSystem()
    fs.files.set('/incoming/Theme.ocpack', new Uint8Array([7, 7]))
    installer.previewResourcePackage.mockReset()
    installer.previewResourcePackage.mockResolvedValue(manifest('theme', 'Theme', '1.0.0'))

    const imported = await createLibrary(fs).importPackage('/incoming/Theme.ocpack')

    expect(installer.previewResourcePackage).toHaveBeenCalledWith({
      projectRootPath: '/app/packages',
      sourcePath: '/incoming/Theme.ocpack',
    })
    expect(imported).toEqual({
      path: '/app/packages/theme.ocpack',
      key: 'theme',
      name: 'Theme',
      version: '1.0.0',
    })
    expect(fs.files.get('/app/packages/theme.ocpack')).toEqual(new Uint8Array([7, 7]))
  })

  it('keeps an already stored package under the same Key and suffixes the new file', async () => {
    const fs = new MemoryFileSystem()
    fs.directories.add('/app/packages')
    fs.files.set('/app/packages/theme.ocpack', new Uint8Array([1]))
    fs.files.set('/incoming/Theme.ocpack', new Uint8Array([2]))
    installer.previewResourcePackage.mockReset()
    installer.previewResourcePackage.mockResolvedValue(manifest('theme', 'Theme', '2.0.0'))

    const imported = await createLibrary(fs).importPackage('/incoming/Theme.ocpack')

    expect(imported.path).toBe('/app/packages/theme-2.ocpack')
    expect(fs.files.get('/app/packages/theme.ocpack')).toEqual(new Uint8Array([1]))
    expect(fs.files.get('/app/packages/theme-2.ocpack')).toEqual(new Uint8Array([2]))
  })

  it('refuses to store a package the installer rejects', async () => {
    const fs = new MemoryFileSystem()
    fs.files.set('/incoming/Broken.ocpack', new Uint8Array([3]))
    installer.previewResourcePackage.mockReset()
    installer.previewResourcePackage.mockRejectedValue(new Error('Missing packaged font file: fonts/x.ttf'))

    await expect(createLibrary(fs).importPackage('/incoming/Broken.ocpack'))
      .rejects.toThrow('Missing packaged font file: fonts/x.ttf')
    expect(fs.files.has('/app/packages/Broken.ocpack')).toBe(false)
  })

  it('offers only package archives in the file dialog', async () => {
    const fs = new MemoryFileSystem()

    await createLibrary(fs).pickSourceFile('Choose a package')

    expect(fs.pickFile).toHaveBeenCalledWith({
      title: 'Choose a package',
      fileTypeName: 'OpenCard package',
      extensions: ['ocpack'],
    })
  })

  it('removes one stored package', async () => {
    const fs = new MemoryFileSystem()
    fs.directories.add('/app/packages')
    fs.files.set('/app/packages/theme.ocpack', new Uint8Array([1]))

    await createLibrary(fs).removePackage('/app/packages/theme.ocpack')

    expect(fs.files.has('/app/packages/theme.ocpack')).toBe(false)
  })
})
