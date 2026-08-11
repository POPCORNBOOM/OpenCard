import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import type { FileSystemService } from './fileSystemService'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'
import { createProjectCustomBlockArchive } from './projectCustomBlock'
import {
  UserCustomBlockCatalogService,
  type UserCustomBlockCatalogPathService,
} from './userCustomBlockCatalogService'

async function blockBytes(key: string, name: string, fieldKey = 'label'): Promise<Uint8Array> {
  const root = createBlock('text-block', { id: 'root' })
  root.additionalFieldDefinition = { [fieldKey]: { fieldType: 'string' } }
  ;(root as unknown as Record<string, unknown>)[fieldKey] = 'Default'
  const manifest = await buildProjectCustomBlockManifest({ root, key, exposedFieldKeys: [fieldKey] })
  manifest.name = name
  return createProjectCustomBlockArchive(manifest, root)
}

function createHarness(initialFiles: ReadonlyMap<string, Uint8Array> = new Map()) {
  const files = new Map<string, Uint8Array>(initialFiles)
  const directories = new Set(['/app/custom-blocks'])
  const fs = {
    pickFile: async () => null,
    readBinaryFile: async (path: string) => {
      const content = files.get(path)
      if (!content) throw new Error(`Missing ${path}`)
      return content.slice()
    },
    writeBinaryFile: async (path: string, content: Uint8Array) => { files.set(path, content.slice()) },
    createDirectory: async (path: string) => { directories.add(path) },
    readDirectory: async (path: string) => [...files.keys()]
      .filter(file => file.startsWith(`${path}/`) && !file.slice(path.length + 1).includes('/'))
      .map(file => ({
        name: file.slice(path.length + 1),
        isFile: true,
        isDirectory: false,
        isSymlink: false,
      })),
    fileExists: async (path: string) => files.has(path) || directories.has(path),
  } as unknown as FileSystemService
  const paths: UserCustomBlockCatalogPathService = {
    appStorageDir: async () => '/app',
    join: async (...parts) => parts.join('/').replace(/\/+/g, '/'),
  }
  return { files, service: new UserCustomBlockCatalogService(fs, paths) }
}

describe('UserCustomBlockCatalogService', () => {
  it('loads valid packages and reports invalid and case-duplicate entries as warnings', async () => {
    const valid = await blockBytes('Badge', 'Badge')
    const duplicate = await blockBytes('badge', 'Duplicate badge')
    const { service } = createHarness(new Map([
      ['/app/custom-blocks/a.ocblock', valid],
      ['/app/custom-blocks/b.ocblock', duplicate],
      ['/app/custom-blocks/broken.ocblock', new Uint8Array([1, 2, 3])],
    ]))

    const catalog = await service.loadCatalog()

    expect(catalog.blocks).toHaveLength(1)
    expect(catalog.blocks[0]).toMatchObject({ key: 'user:badge', customBlockKey: 'Badge', name: 'Badge' })
    expect(catalog.warnings).toHaveLength(2)
  })

  it('installs a new package into the application custom-block directory', async () => {
    const incoming = await blockBytes('badge', 'Badge')
    const { files, service } = createHarness(new Map([['/incoming/badge.ocblock', incoming]]))

    await expect(service.importUserCustomBlock('/incoming/badge.ocblock'))
      .resolves.toBe('/app/custom-blocks/badge.ocblock')
    expect(files.get('/app/custom-blocks/badge.ocblock')).toEqual(incoming)
  })

  it('updates an existing Key in place using the new package schema', async () => {
    const installed = await blockBytes('Badge', 'Original')
    const compatible = await blockBytes('badge', 'Updated')
    const incompatible = await blockBytes('BADGE', 'Incompatible', 'other')
    const { files, service } = createHarness(new Map([
      ['/app/custom-blocks/original.ocblock', installed],
      ['/incoming/compatible.ocblock', compatible],
      ['/incoming/incompatible.ocblock', incompatible],
    ]))

    await expect(service.importUserCustomBlock('/incoming/compatible.ocblock'))
      .resolves.toBe('/app/custom-blocks/original.ocblock')
    expect(files.get('/app/custom-blocks/original.ocblock')).toEqual(compatible)

    await expect(service.importUserCustomBlock('/incoming/incompatible.ocblock'))
      .resolves.toBe('/app/custom-blocks/original.ocblock')
    expect(files.get('/app/custom-blocks/original.ocblock')).toEqual(incompatible)
  })
})
