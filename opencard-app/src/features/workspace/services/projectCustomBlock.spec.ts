import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, zipSync } from 'fflate'
import { createBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'
import {
  MAX_CUSTOM_BLOCK_ENTRIES,
  createProjectCustomBlockArchive,
  discoverInstalledProjectCustomBlocks,
  installProjectCustomBlockPackageFromBytes,
  readProjectCustomBlockPackageFromBytes,
  uninstallProjectCustomBlockPackage,
} from './projectCustomBlock'

class MemoryFs {
  readonly files = new Map<string, Uint8Array>()
  readonly directories = new Set<string>()
  failRename: ((source: string, target: string) => boolean) | null = null

  normalize(path: string): string { return path.replace(/\\/g, '/').replace(/\/+$/, '') }
  async createDirectory(path: string): Promise<void> {
    const normalized = this.normalize(path)
    const segments = normalized.split('/')
    for (let index = 1; index <= segments.length; index += 1) {
      this.directories.add(segments.slice(0, index).join('/'))
    }
  }
  async fileExists(path: string): Promise<boolean> {
    const normalized = this.normalize(path)
    return this.files.has(normalized) || this.directories.has(normalized)
  }
  async writeFile(path: string, content: string): Promise<void> {
    await this.createDirectory(path.slice(0, path.lastIndexOf('/')))
    this.files.set(this.normalize(path), strToU8(content))
  }
  async writeBinaryFile(path: string, bytes: Uint8Array): Promise<void> {
    await this.createDirectory(path.slice(0, path.lastIndexOf('/')))
    this.files.set(this.normalize(path), new Uint8Array(bytes))
  }
  async readFile(path: string): Promise<string> {
    const bytes = this.files.get(this.normalize(path))
    if (!bytes) throw new Error(`Missing file: ${path}`)
    return strFromU8(bytes)
  }
  async readBinaryFile(path: string): Promise<Uint8Array> {
    const bytes = this.files.get(this.normalize(path))
    if (!bytes) throw new Error(`Missing file: ${path}`)
    return new Uint8Array(bytes)
  }
  async renameFile(source: string, target: string): Promise<void> {
    const from = this.normalize(source)
    const to = this.normalize(target)
    if (this.failRename?.(from, to)) throw new Error('Injected rename failure')
    const matchingDirectories = [...this.directories].filter(path => path === from || path.startsWith(`${from}/`))
    const matchingFiles = [...this.files].filter(([path]) => path === from || path.startsWith(`${from}/`))
    if (matchingDirectories.length === 0 && matchingFiles.length === 0) throw new Error(`Missing path: ${source}`)
    for (const path of matchingDirectories) this.directories.delete(path)
    for (const [path] of matchingFiles) this.files.delete(path)
    for (const path of matchingDirectories) this.directories.add(`${to}${path.slice(from.length)}`)
    for (const [path, bytes] of matchingFiles) this.files.set(`${to}${path.slice(from.length)}`, bytes)
  }
  async deleteFile(path: string): Promise<void> {
    const target = this.normalize(path)
    for (const candidate of [...this.directories]) {
      if (candidate === target || candidate.startsWith(`${target}/`)) this.directories.delete(candidate)
    }
    for (const candidate of [...this.files.keys()]) {
      if (candidate === target || candidate.startsWith(`${target}/`)) this.files.delete(candidate)
    }
  }
  async readDirectoryEntries(path: string, depth = 1): Promise<Array<{ name: string, isDirectory: boolean, isFile: boolean, isSymlink: boolean }>> {
    const root = this.normalize(path)
    return [...this.directories]
      .filter(candidate => candidate.startsWith(`${root}/`))
      .map(candidate => candidate.slice(root.length + 1))
      .filter(relative => relative.split('/').length <= depth)
      .map(name => ({ name, isDirectory: true, isFile: false, isSymlink: false }))
  }
}

async function fixture(content = 'Default') {
  const block = createBlock('text-block', { id: 'root', name: 'Badge', content })
  const manifest = await buildProjectCustomBlockManifest({
    root: block,
    publisherKey: 'alice',
    blockKey: 'status-badge',
    exposedFieldKeys: ['content'],
  })
  return { manifest, block }
}

function markFirstEntryAsSymlink(archive: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(archive)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let offset = 0; offset <= bytes.length - 46; offset += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue
    view.setUint16(offset + 4, 3 << 8, true)
    view.setUint32(offset + 38, 0xa000 << 16, true)
    return bytes
  }
  throw new Error('Missing ZIP central directory')
}

function setArchiveEntryCount(archive: Uint8Array, count: number): Uint8Array {
  const bytes = new Uint8Array(archive)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) !== 0x06054b50) continue
    view.setUint16(offset + 8, count, true)
    view.setUint16(offset + 10, count, true)
    return bytes
  }
  throw new Error('Missing ZIP end record')
}

describe('project custom block transport and installation', () => {
  it('round-trips the current package structure and keeps project-relative resource paths', async () => {
    const { manifest, block } = await fixture()
    const archive = createProjectCustomBlockArchive(manifest, block, new Map([
      ['resources/assets/card/background.webp', new Uint8Array([1, 2, 3])],
    ]))
    const result = await readProjectCustomBlockPackageFromBytes(archive)
    expect(result.manifest).toMatchObject({
      packageId: 'alice/status-badge', version: '0.1.0', publicFieldKeys: ['name', 'notes', 'content'],
    })
    expect(result.block).toMatchObject({ type: 'text-block', id: 'root', content: 'Default' })
    expect(result.files.get('resources/assets/card/background.webp')).toEqual(new Uint8Array([1, 2, 3]))
    expect(result.issues).toEqual([])
  })

  it('preserves nested custom block nodes and removes only editor packaging state', async () => {
    const { manifest } = await fixture()
    const root = createBlock('simple-container-block', { id: 'root' })
    root.packaged = 'true'
    root.children.push({
      block: createBlock('custom-block', { id: 'nested', packageId: 'bob/label' }),
      location: { id: 'nested-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const result = await readProjectCustomBlockPackageFromBytes(createProjectCustomBlockArchive(manifest, root))
    expect(result.block).not.toHaveProperty('packaged')
    expect(result.block?.type === 'simple-container-block' && result.block.children[0]?.block).toMatchObject({
      type: 'custom-block', packageId: 'bob/label',
    })
  })

  it('rejects malformed JSON, unsafe paths, duplicate paths, symlinks, and excessive entry counts', async () => {
    await expect(readProjectCustomBlockPackageFromBytes(zipSync({
      'manifest.json': strToU8('{'), 'block.json': strToU8('{}'), 'resources/': new Uint8Array(),
    }))).rejects.toThrow('manifest JSON')
    await expect(readProjectCustomBlockPackageFromBytes(zipSync({
      '../manifest.json': strToU8('{}'),
    }))).rejects.toThrow('archive path')
    await expect(readProjectCustomBlockPackageFromBytes(zipSync({
      'manifest.json': strToU8('{}'), 'MANIFEST.JSON': strToU8('{}'),
    }))).rejects.toThrow('Duplicate')
    const regular = zipSync({ 'resources/link': strToU8('target') })
    await expect(readProjectCustomBlockPackageFromBytes(markFirstEntryAsSymlink(regular))).rejects.toThrow('symbolic link')
    await expect(readProjectCustomBlockPackageFromBytes(
      setArchiveEntryCount(regular, MAX_CUSTOM_BLOCK_ENTRIES + 1),
    )).rejects.toThrow('exceeds limits')
  })

  it('installs to the Package ID directory, updates atomically, and rolls back a failed replacement', async () => {
    const fs = new MemoryFs()
    const initial = await fixture('Initial')
    const initialArchive = createProjectCustomBlockArchive(initial.manifest, initial.block)
    const first = await installProjectCustomBlockPackageFromBytes({
      fs, projectRootPath: 'D:/project', bytes: initialArchive, createId: () => 'first',
    })
    expect(first).toMatchObject({
      installationPath: '.opencard/blocks/alice/status-badge', replaced: false,
    })
    const blockPath = 'D:/project/.opencard/blocks/alice/status-badge/block.json'
    expect(JSON.parse(await fs.readFile(blockPath))).toMatchObject({ content: 'Initial' })

    const updated = await fixture('Updated')
    const updateResult = await installProjectCustomBlockPackageFromBytes({
      fs, projectRootPath: 'D:/project', bytes: createProjectCustomBlockArchive(updated.manifest, updated.block), createId: () => 'update',
    })
    expect(updateResult.replaced).toBe(true)
    expect(JSON.parse(await fs.readFile(blockPath))).toMatchObject({ content: 'Updated' })

    const failed = await fixture('Broken update')
    fs.failRename = (source, target) => source.includes('.install-failure') && target.endsWith('/status-badge')
    await expect(installProjectCustomBlockPackageFromBytes({
      fs, projectRootPath: 'D:/project', bytes: createProjectCustomBlockArchive(failed.manifest, failed.block), createId: () => 'failure',
    })).rejects.toThrow('Injected rename failure')
    expect(JSON.parse(await fs.readFile(blockPath))).toMatchObject({ content: 'Updated' })
    expect([...fs.directories].some(path => path.includes('.install-failure') || path.includes('.backup-failure'))).toBe(false)
  })

  it('discovers manifests without loading block.json and marks malformed or misplaced packages unavailable', async () => {
    const fs = new MemoryFs()
    const validRoot = 'D:/project/.opencard/blocks/alice/valid'
    await fs.createDirectory(`${validRoot}/resources`)
    await fs.writeFile(`${validRoot}/manifest.json`, JSON.stringify({
      type: 'opencard-custom-block', packageId: 'alice/valid', version: '1.0.0', name: 'Valid', publicFieldKeys: [], resize: {},
    }))
    const malformedRoot = 'D:/project/.opencard/blocks/alice/malformed'
    await fs.createDirectory(malformedRoot)
    await fs.writeFile(`${malformedRoot}/manifest.json`, '{')
    const misplacedRoot = 'D:/project/.opencard/blocks/alice/misplaced'
    await fs.createDirectory(misplacedRoot)
    await fs.writeFile(`${misplacedRoot}/manifest.json`, JSON.stringify({
      type: 'opencard-custom-block', packageId: 'bob/other', version: '1.0.0', name: 'Other', publicFieldKeys: [], resize: {},
    }))

    const catalog = await discoverInstalledProjectCustomBlocks(fs, 'D:/project')
    expect(catalog.get('alice/valid')).toMatchObject({ loadState: 'unloaded' })
    expect(catalog.get('alice/valid')).not.toHaveProperty('unavailable')
    expect(catalog.get('alice/malformed')).toMatchObject({ loadState: 'error', unavailable: true })
    expect(catalog.get('alice/misplaced')).toMatchObject({
      manifest: { packageId: 'alice/misplaced' }, loadState: 'error', unavailable: true,
    })
  })

  it('uninstalls the complete Package ID directory', async () => {
    const fs = new MemoryFs()
    const { manifest, block } = await fixture()
    await installProjectCustomBlockPackageFromBytes({
      fs, projectRootPath: 'D:/project', bytes: createProjectCustomBlockArchive(manifest, block), createId: () => 'install',
    })
    await expect(uninstallProjectCustomBlockPackage({
      fs, projectRootPath: 'D:/project', packageId: 'alice/status-badge',
    })).resolves.toBe(true)
    await expect(fs.fileExists('D:/project/.opencard/blocks/alice/status-badge')).resolves.toBe(false)
  })
})
