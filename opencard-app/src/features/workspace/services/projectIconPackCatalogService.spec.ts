import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import type { FileSystemService } from './fileSystemService'
import { ProjectIconPackCatalogService, type ProjectIconPackPathService } from './projectIconPackCatalogService'

function packBytes(name: string, key: string): Uint8Array {
  return zipSync({
    'iconpack.json': strToU8(JSON.stringify({
      type: 'opencard-icon-pack', schemaVersion: '1', name, key,
      spritesheet: 'spritesheet.png', icons: [],
    })),
    'spritesheet.png': new Uint8Array([1]),
  })
}

function createHarness() {
  const files = new Map<string, string | Uint8Array>([
    ['/resources/icon-packs/index.json', JSON.stringify({ schemaVersion: 1, packs: ['shared.ociconpack'] })],
    ['/resources/icon-packs/shared.ociconpack', packBytes('Built-in Status', 'builtin-status')],
    ['/incoming/user.ociconpack', packBytes('User Status', 'user-status')],
  ])
  const directories = new Set(['/app/icon-packs'])
  const fs = {
    readFile: async (path: string) => String(files.get(path) ?? ''),
    readBinaryFile: async (path: string) => {
      const content = files.get(path)
      if (content === undefined) throw new Error(`Missing ${path}`)
      return content instanceof Uint8Array ? content : new TextEncoder().encode(content)
    },
    writeBinaryFile: async (path: string, content: Uint8Array) => { files.set(path, content.slice()) },
    createDirectory: async (path: string) => { directories.add(path) },
    readDirectory: async () => [{ name: 'mine.ociconpack', isFile: true, isDirectory: false, isSymlink: false }],
    fileExists: async (path: string) => files.has(path) || directories.has(path),
  } as unknown as FileSystemService
  const paths: ProjectIconPackPathService = {
    appStorageDir: async () => '/app',
    basename: async (path) => path.replace(/\\/g, '/').split('/').pop() ?? path,
    join: async (...parts) => parts.join('/').replace(/\/+/g, '/'),
    resolveResource: async (path) => `/resources/${path}`,
  }
  files.set('/app/icon-packs/mine.ociconpack', packBytes('User Status', 'user-status'))
  return { files, service: new ProjectIconPackCatalogService(fs, paths) }
}

describe('ProjectIconPackCatalogService', () => {
  it('loads built-in and user packs through the same validated catalog', async () => {
    const { service } = createHarness()
    const catalog = await service.loadCatalog()
    expect(catalog.packs.map((pack) => [pack.source, pack.name])).toEqual([
      ['builtin', 'Built-in Status'],
      ['user', 'User Status'],
    ])
  })

  it('copies a validated package into the user icon-pack directory by pack name', async () => {
    const { files, service } = createHarness()
    await service.importUserIconPack('/incoming/user.ociconpack')
    expect(files.has('/app/icon-packs/User Status.ociconpack')).toBe(true)
  })
})
