import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { buildResourcePackageArchive } from './resourcePackageBuilder'
import {
  inspectResourcePackage,
  installResourcePackage,
  uninstallResourcePackage,
} from './resourcePackageInstaller'
import type { FileSystemService } from './fileSystemService'

class MemoryFileSystem implements Partial<FileSystemService> {
  private readonly files = new Map<string, Uint8Array | string>()
  private readonly directories = new Set<string>()

  async readBinaryFile(path: string): Promise<Uint8Array> {
    const value = this.files.get(path)
    if (!(value instanceof Uint8Array)) throw new Error(`Missing binary file: ${path}`)
    return value
  }

  async readFile(path: string): Promise<string> {
    const value = this.files.get(path)
    if (typeof value !== 'string') throw new Error(`Missing text file: ${path}`)
    return value
  }

  async writeFile(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }

  async writeBinaryFile(path: string, content: Uint8Array): Promise<void> {
    this.files.set(path, new Uint8Array(content))
  }

  async fileExists(path: string): Promise<boolean> {
    return this.files.has(path) || this.directories.has(path)
  }

  async createDirectory(path: string): Promise<void> {
    this.directories.add(path)
  }

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const movedFiles = [...this.files.entries()].filter(([path]) => path === oldPath || path.startsWith(`${oldPath}/`))
    const movedDirectories = [...this.directories].filter(path => path === oldPath || path.startsWith(`${oldPath}/`))
    if (movedFiles.length === 0 && movedDirectories.length === 0) throw new Error(`Missing path: ${oldPath}`)
    for (const [path, value] of movedFiles) {
      this.files.delete(path)
      this.files.set(`${newPath}${path.slice(oldPath.length)}`, value)
    }
    for (const path of movedDirectories) {
      this.directories.delete(path)
      this.directories.add(`${newPath}${path.slice(oldPath.length)}`)
    }
  }

  async deleteFile(path: string): Promise<void> {
    for (const key of [...this.files.keys()]) if (key === path || key.startsWith(`${path}/`)) this.files.delete(key)
    for (const key of [...this.directories]) if (key === path || key.startsWith(`${path}/`)) this.directories.delete(key)
  }

  putText(path: string, value: string): void { this.files.set(path, value) }
  has(path: string): boolean { return this.files.has(path) || this.directories.has(path) }
}

async function archive(version = '1.0.0') {
  return (await buildResourcePackageArchive({
    key: 'theme', name: 'Theme', version,
    files: [{ path: 'assets/card.png', bytes: strToU8(version) }],
  })).archive
}

describe('resourcePackageInstaller', () => {
  it('inspects and atomically installs a package', async () => {
    const fs = new MemoryFileSystem()
    const result = await installResourcePackage({ fs, projectRootPath: '/project', bytes: await archive(), createId: () => 'one' })
    expect(result.replaced).toBe(false)
    expect(fs.has('/project/.opencard/packages/theme/.opencard/manifest.json')).toBe(true)
    expect(fs.has('/project/.opencard/packages/theme/assets/card.png')).toBe(true)
  })

  it('keeps the old package when an upgrade is cancelled', async () => {
    const fs = new MemoryFileSystem()
    await installResourcePackage({ fs, projectRootPath: '/project', bytes: await archive(), createId: () => 'one' })
    await expect(installResourcePackage({
      fs, projectRootPath: '/project', bytes: await archive('2.0.0'), createId: () => 'two',
      confirmReplacement: () => false,
    })).rejects.toThrow('cancelled')
    const inspection = await inspectResourcePackage({ fs, projectRootPath: '/project', bytes: await archive() })
    expect(inspection.existingManifest?.version).toBe('1.0.0')
  })

  it('rejects unsafe archive paths and content hash mismatches before installation', async () => {
    const fs = new MemoryFileSystem()
    const valid = await archive()
    const unsafe = (await buildResourcePackageArchive({
      key: 'theme', name: 'Theme', version: '1.0.0', files: [{ path: 'assets/card.png', bytes: strToU8('x') }],
    })).archive
    const unsafeArchive = zipSync({ '../outside.txt': strToU8('x') })
    await expect(inspectResourcePackage({ fs, projectRootPath: '/project', bytes: unsafeArchive })).rejects.toThrow('Unsafe resource package archive path')
    const unpacked = unzipSync(valid)
    const manifest = JSON.parse(strFromU8(unpacked['.opencard/manifest.json']!)) as { contentHash: string }
    manifest.contentHash = '0'.repeat(64)
    unpacked['.opencard/manifest.json'] = strToU8(JSON.stringify(manifest))
    const tampered = zipSync(unpacked)
    await expect(inspectResourcePackage({ fs, projectRootPath: '/project', bytes: tampered })).rejects.toThrow('content hash')
    expect(unsafe).toBeDefined()
  })

  it('uninstalls the complete package root', async () => {
    const fs = new MemoryFileSystem()
    await installResourcePackage({ fs, projectRootPath: '/project', bytes: await archive(), createId: () => 'one' })
    expect(await uninstallResourcePackage({ fs, projectRootPath: '/project', packageKey: 'theme' })).toBe(true)
    expect(fs.has('/project/.opencard/packages/theme')).toBe(false)
  })

  it('reports dependent packages before removal and preserves the root when cancelled', async () => {
    const fs = new MemoryFileSystem()
    const installed = await installResourcePackage({ fs, projectRootPath: '/project', bytes: await archive(), createId: () => 'one' })
    const dependent = {
      ...installed.manifest,
      key: 'consumer',
      dependencies: [{ key: 'theme', version: installed.manifest.version, contentHash: installed.manifest.contentHash }],
    }
    await expect(uninstallResourcePackage({
      fs, projectRootPath: '/project', packageKey: 'theme',
      manifest: installed.manifest, dependents: [dependent], confirmRemoval: () => false,
    })).rejects.toThrow('cancelled')
    expect(fs.has('/project/.opencard/packages/theme')).toBe(true)
    await expect(uninstallResourcePackage({
      fs, projectRootPath: '/project', packageKey: 'theme',
      manifest: installed.manifest, dependents: [dependent], confirmRemoval: impact => impact.dependents[0]?.key === 'consumer',
    })).resolves.toBe(true)
    expect(fs.has('/project/.opencard/packages/theme')).toBe(false)
  })
})
