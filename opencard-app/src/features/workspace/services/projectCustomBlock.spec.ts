import { describe, expect, it, vi } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { createBlock, type CardBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'
import {
  createProjectCustomBlockArchive,
  exportProjectCustomBlockPackage,
  readProjectCustomBlockManifestFromBytes,
  readProjectCustomBlockPackageFromBytes,
} from './projectCustomBlock'
import {
  PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME,
  PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME,
  serializeProjectCustomBlockManifest,
} from '../model/projectCustomBlocks'

async function fixture(): Promise<{ manifest: Awaited<ReturnType<typeof buildProjectCustomBlockManifest>>; block: CardBlock }> {
  const block = createBlock('text-block', { id: 'root' })
  block.additionalFieldDefinition = { label: { fieldType: 'string' } }
  ;(block as unknown as Record<string, unknown>).label = 'Default'
  const manifest = await buildProjectCustomBlockManifest({ root: block, key: 'label', exposedFieldKeys: ['label'] })
  return { manifest, block }
}

describe('project custom block package projection', () => {
  it('round-trips manifest.json and a pure block.json', async () => {
    const { manifest, block } = await fixture()
    const archive = createProjectCustomBlockArchive(manifest, block)

    await expect(readProjectCustomBlockManifestFromBytes(archive)).resolves.toMatchObject({
      manifest: { customBlockKey: 'label', publicFieldKeys: ['name', 'notes', 'label'] },
      issues: [],
    })
    await expect(readProjectCustomBlockPackageFromBytes(archive)).resolves.toMatchObject({
      manifest: { customBlockKey: 'label' },
      block: { type: 'text-block', id: 'root', label: 'Default' },
    })
  })

  it('validates image, font, and icon resources by package-local logical key', async () => {
    const block = createBlock('simple-container-block', { id: 'root' })
    block.children.push(
      {
        block: createBlock('image-block', { id: 'image', image: 'resource:image:badge' }),
        location: { id: 'image-location', type: 'simple-container-location', anchor: 'lt' },
      },
      {
        block: createBlock('text-block', {
          id: 'text',
          content: '[[icon:icons/star]]',
          fontFamily: 'resource:font:heading; Arial',
        }),
        location: { id: 'text-location', type: 'simple-container-location', anchor: 'lt' },
      },
    )
    const manifest = await buildProjectCustomBlockManifest({ root: block, key: 'badge' })
    manifest.resources = {
      fonts: [{ key: 'heading', name: 'Heading', source: 'resources/fonts/heading.woff2' }],
      images: [{ key: 'badge', source: 'resources/images/badge.png' }],
      iconSeries: [{
        key: 'icons', name: 'Badge icons', source: 'resources/icons/icons.png',
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
      fs: { writeBinaryFile }, manifest, block, files, outputPath: 'badge',
    })).resolves.toBe('badge.ocblock')
    expect(writeBinaryFile).toHaveBeenCalledOnce()
  })

  it('ignores extra manifest fields and defaults a missing manifest', async () => {
    const { manifest, block } = await fixture()
    const legacyManifest = { ...manifest, source: 'block:label', interfaceHash: 'legacy', publicFields: [] }
    const archive = zipSync({
      [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(JSON.stringify(legacyManifest)),
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(block)),
    })
    const projected = await readProjectCustomBlockPackageFromBytes(archive)
    expect(projected.manifest.customBlockKey).toBe('label')
    expect(projected.manifest).not.toHaveProperty('source')
    expect(projected.manifest).not.toHaveProperty('interfaceHash')

    const withoutManifest = await readProjectCustomBlockPackageFromBytes(zipSync({
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(block)),
    }), 'fallback-name.ocblock')
    expect(withoutManifest.manifest.customBlockKey).toBe('fallback-name')
    expect(withoutManifest.block?.id).toBe('root')
    expect(withoutManifest.issues.some(issue => issue.path === 'manifest.json')).toBe(true)
  })

  it('ignores nested custom Blocks and editor packaging state while keeping the root', async () => {
    const { manifest } = await fixture()
    const nested = createBlock('simple-container-block', { id: 'root' })
    nested.children.push({
      block: createBlock('custom-block', { id: 'nested', customBlockKey: 'other' }),
      location: { id: 'nested-location', type: 'simple-container-location', anchor: 'lt' },
    })
    nested.packaged = 'true'
    const archive = zipSync({
      [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest({ ...manifest, publicFieldKeys: [] })),
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(nested)),
    })
    const result = await readProjectCustomBlockPackageFromBytes(archive)
    expect(result.block).toMatchObject({ id: 'root', children: [] })
    expect(result.block).not.toHaveProperty('packaged')
    expect(result.issues.some(issue => issue.code === 'block-entry-ignored')).toBe(true)
  })

  it('filters public keys that are unavailable on the root', async () => {
    const { manifest } = await fixture()
    const archive = zipSync({
      [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest(manifest)),
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(createBlock('text-block', { id: 'root' }))),
    })
    const result = await readProjectCustomBlockPackageFromBytes(archive)
    expect(result.manifest.publicFieldKeys).toEqual(['name', 'notes'])
    expect(result.issues.some(issue => issue.path.includes('publicFieldKeys'))).toBe(true)
  })

  it('keeps an editable native root field in the public projection', async () => {
    const { manifest, block } = await fixture()
    const archive = zipSync({
      [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest({
        ...manifest, publicFieldKeys: ['content'],
      })),
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(block)),
    })
    const result = await readProjectCustomBlockPackageFromBytes(archive)
    expect(result.manifest.publicFieldKeys).toEqual(['name', 'notes', 'content'])
  })

  it('keeps a package descriptor when manifest or Block JSON cannot be read', async () => {
    const malformedManifest = await readProjectCustomBlockPackageFromBytes(zipSync({
      [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8('{'),
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8('{'),
    }), 'Broken Package.ocblock')
    expect(malformedManifest.manifest.customBlockKey).toBe('broken-package')
    expect(malformedManifest.block).toBeNull()
    expect(malformedManifest.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'manifest-field-ignored', 'block-unavailable',
    ]))
  })

  it('does not allow caller files to replace either package metadata entry', async () => {
    const { manifest, block } = await fixture()
    expect(() => createProjectCustomBlockArchive(manifest, block, new Map([
      ['BLOCK.JSON', new Uint8Array([1])],
    ]))).toThrow('Invalid custom block archive path')
  })

  it('rejects unindexed, cross-package, and external static resources', async () => {
    const { manifest } = await fixture()
    for (const image of ['resource:image:missing', 'ocblock:other/resources/image.png', 'https://example.com/a.png']) {
      const block = createBlock('image-block', { id: 'root', image })
      expect(() => createProjectCustomBlockArchive({ ...manifest, publicFieldKeys: [] }, block)).toThrow()
    }
  })

  it('keeps usable package content when one indexed resource is missing', async () => {
    const { manifest, block } = await fixture()
    manifest.resources = {
      images: [
        { key: 'present', source: 'resources/images/present.png' },
        { key: 'missing', source: 'resources/images/missing.png' },
      ],
    }
    const archive = zipSync({
      [PROJECT_CUSTOM_BLOCK_MANIFEST_FILE_NAME]: strToU8(serializeProjectCustomBlockManifest(manifest)),
      [PROJECT_CUSTOM_BLOCK_BLOCK_FILE_NAME]: strToU8(JSON.stringify(block)),
      'resources/images/present.png': new Uint8Array([1]),
    })

    const result = await readProjectCustomBlockPackageFromBytes(archive)
    expect(result.block?.id).toBe('root')
    expect(result.files.has('resources/images/present.png')).toBe(true)
    expect(result.hasResourceErrors).toBe(true)
  })

  it('rejects corrupt and over-populated archives before unpacking', async () => {
    await expect(readProjectCustomBlockPackageFromBytes(new Uint8Array([1, 2, 3]))).rejects.toThrow()
    const entries = Object.fromEntries(Array.from({ length: 257 }, (_, index) => [
      `resources/images/${index}.png`, new Uint8Array([index]),
    ]))
    await expect(readProjectCustomBlockPackageFromBytes(zipSync(entries))).rejects.toThrow('exceeds limits')
    await expect(readProjectCustomBlockManifestFromBytes(zipSync({
      '../manifest.json': strToU8('{}'),
    }))).rejects.toThrow('archive path')
  })
})
