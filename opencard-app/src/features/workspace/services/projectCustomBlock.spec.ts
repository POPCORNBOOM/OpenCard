import { describe, expect, it, vi } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { createBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'
import {
  createProjectCustomBlockArchive,
  exportProjectCustomBlockPackage,
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

  it('validates a package with every resource type before writing it', async () => {
    const root = createBlock('text-block', {
      id: 'root',
      content: '[[icon:ocblock-badge/star]]',
      fontFamily: 'OpenCardCustomBlock-badge-heading',
    })
    const manifest = await buildProjectCustomBlockManifest({ root, key: 'badge' })
    manifest.resources = {
      fonts: [{ key: 'heading', name: 'Heading', source: 'resources/fonts/heading.woff2' }],
      images: [{ key: 'badge', source: 'resources/images/badge.png' }],
      iconSeries: [{
        key: 'ocblock-badge', name: 'Badge icons', source: 'resources/icons/icons.png',
        icons: [{ iconKey: 'star', name: 'Star', x: 0, y: 0, width: 16, height: 16 }],
      }],
    }
    const files = new Map([
      ['resources/fonts/heading.woff2', new Uint8Array([1])],
      ['resources/images/badge.png', new Uint8Array([2])],
      ['resources/icons/icons.png', new Uint8Array([3])],
    ])
    const writeBinaryFile = vi.fn(async (_path: string, _bytes: Uint8Array) => undefined)

    await expect(exportProjectCustomBlockPackage({
      fs: { writeBinaryFile }, manifest, files, outputPath: 'badge',
    })).resolves.toBe('badge.ocblock')
    expect(writeBinaryFile).toHaveBeenCalledOnce()
    const written = writeBinaryFile.mock.calls[0]![1]
    await expect(readProjectCustomBlockPackageFromBytes(written)).resolves.toMatchObject({
      manifest: { key: 'badge' },
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

  it('does not export case-duplicate archive paths that its importer rejects', async () => {
    const manifest = await createManifest()
    manifest.resources = { images: [{ key: 'image', source: 'resources/images/a.png' }] }
    expect(() => createProjectCustomBlockArchive(manifest, new Map([
      ['resources/images/a.png', new Uint8Array([1])],
      ['RESOURCES/IMAGES/A.PNG', new Uint8Array([2])],
    ]))).toThrow('Invalid custom block archive path')
    expect(() => createProjectCustomBlockArchive(manifest, new Map([
      ['BLOCK.JSON', new Uint8Array([1])],
      ['resources/images/a.png', new Uint8Array([2])],
    ]))).toThrow('Invalid custom block archive path')
  })

  it('uses one case-insensitive identity for indexed resources and package references', async () => {
    const root = createBlock('image-block', {
      id: 'root',
      image: 'ocblock:BADGE/RESOURCES/IMAGES/A.PNG',
    })
    const manifest = await buildProjectCustomBlockManifest({ root, key: 'Badge' })
    manifest.resources = { images: [{ key: 'image', source: 'resources/images/a.png' }] }
    const archive = createProjectCustomBlockArchive(manifest, new Map([
      ['RESOURCES/IMAGES/A.PNG', new Uint8Array([1])],
    ]))
    await expect(readProjectCustomBlockPackageFromBytes(archive)).resolves.toMatchObject({
      manifest: { key: 'Badge' },
    })
  })

  it('rejects archives with too many entries before unpacking', async () => {
    const entries = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [
      `resources/images/${index}.png`, new Uint8Array([index]),
    ]))
    await expect(readProjectCustomBlockPackageFromBytes(zipSync(entries))).rejects.toThrow('exceeds limits')
  })

  it('rejects package resource references that are absent from the manifest index', async () => {
    const manifest = await createManifest()
    manifest.root = createBlock('image-block', { id: 'root', image: 'ocblock:label/resources/images/missing.png' })
    manifest.publicFields = []

    expect(() => createProjectCustomBlockArchive(manifest)).toThrow('image reference is not indexed')
  })

  it('rejects rich-text icon references that are absent from the manifest index', async () => {
    const manifest = await createManifest()
    manifest.root = createBlock('text-block', {
      id: 'root',
      content: '<span data-oc-icon-series="ocblock-label" data-oc-icon-key="missing"></span>',
    })
    manifest.publicFields = []

    expect(() => createProjectCustomBlockArchive(manifest)).toThrow('icon reference is not indexed')
  })
})
