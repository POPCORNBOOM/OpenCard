import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { createBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'
import {
  createProjectCustomBlockArchive,
  readProjectCustomBlockPackageFromBytes,
} from './projectCustomBlock'
import { serializeProjectCustomBlockManifest } from '../model/projectCustomBlocks'

async function createManifest() {
  const root = createBlock('text-block', { id: 'root' })
  root.additionalFieldDefinition = { label: { fieldType: 'string' } }
  ;(root as unknown as Record<string, unknown>).label = 'Default'
  return await buildProjectCustomBlockManifest({ root, key: 'label', exposedFieldKeys: ['label'] })
}

describe('project custom block package', () => {
  it('round-trips a valid package and verifies its interface hash', async () => {
    const manifest = await createManifest()
    const archive = createProjectCustomBlockArchive(manifest)

    await expect(readProjectCustomBlockPackageFromBytes(archive)).resolves.toMatchObject({
      manifest: { key: 'label', interfaceHash: manifest.interfaceHash },
    })
  })

  it('rejects an interface hash that does not match the public contract', async () => {
    const manifest = { ...await createManifest(), interfaceHash: 'wrong' }
    const archive = createProjectCustomBlockArchive(manifest)
    await expect(readProjectCustomBlockPackageFromBytes(archive)).rejects.toThrow('interface hash')
  })

  it('rejects unresolved nested custom blocks and editor packaging state', async () => {
    const manifest = await createManifest()
    const nested = createBlock('simple-container-block', { id: 'root' })
    nested.children.push({
      block: createBlock('custom-block', { id: 'nested', source: 'block:other', interfaceHash: 'hash' }),
      location: { id: 'nested-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const unresolved = { ...manifest, root: nested }
    expect(() => createProjectCustomBlockArchive(unresolved)).toThrow('unresolved custom block')

    nested.children = []
    nested.packaged = 'true'
    expect(() => createProjectCustomBlockArchive({ ...manifest, root: nested })).toThrow('packaging state')
  })

  it('normalizes descendant custom field definitions before archive validation', async () => {
    const manifest = await createManifest()
    const root = createBlock('simple-container-block', { id: 'container' })
    const child = createBlock('text-block', { id: 'child' })
    ;(child as unknown as Record<string, unknown>).additionalFieldDefinition = {
      label: { fieldType: 'string', title: 'Label', editorOnly: false },
      invalid: false,
    }
    root.children.push({
      block: child,
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    })

    expect(() => createProjectCustomBlockArchive({ ...manifest, root, publicFields: [] })).not.toThrow()
  })

  it('rejects missing, unlisted, case-duplicate, traversal, and corrupt files', async () => {
    const manifest = await createManifest()
    manifest.resources = { images: [{ key: 'image', source: 'resources/images/a.png' }] }
    const manifestBytes = strToU8(serializeProjectCustomBlockManifest(manifest))

    await expect(readProjectCustomBlockPackageFromBytes(zipSync({ 'block.json': manifestBytes })))
      .rejects.toThrow('resource is missing')
    await expect(readProjectCustomBlockPackageFromBytes(zipSync({
      'block.json': manifestBytes,
      'resources/images/a.png': new Uint8Array([1]),
      'extra.txt': new Uint8Array([2]),
    }))).rejects.toThrow('unlisted file')
    await expect(readProjectCustomBlockPackageFromBytes(zipSync({
      'block.json': manifestBytes,
      'resources/images/a.png': new Uint8Array([1]),
      'RESOURCES/IMAGES/A.PNG': new Uint8Array([2]),
    }))).rejects.toThrow('archive path')
    await expect(readProjectCustomBlockPackageFromBytes(zipSync({
      'block.json': manifestBytes,
      '../resources/images/a.png': new Uint8Array([1]),
    }))).rejects.toThrow('archive path')
    await expect(readProjectCustomBlockPackageFromBytes(new Uint8Array([1, 2, 3])))
      .rejects.toThrow()
  })
})
