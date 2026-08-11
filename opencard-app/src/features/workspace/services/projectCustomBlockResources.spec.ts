import { describe, expect, it, vi } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { collectProjectCustomBlockResources, rewriteProjectCustomBlockResourceReferences } from './projectCustomBlockResources'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'
import { customBlockResourceOwnerIdentity } from '../../card-rendering/expandCustomBlocks'

describe('collectProjectCustomBlockResources', () => {
  it('collects and content-deduplicates local images and project fonts', async () => {
    const root = createBlock('simple-container-block')
    root.children.push({
      block: createBlock('image-block', { image: 'assets/picture.png' }),
      location: { id: 'a', type: 'simple-container-location', anchor: 'lt' },
    })
    root.children.push({
      block: createBlock('text-block', { fontFamily: 'font:body; Arial' }),
      location: { id: 'b', type: 'simple-container-location', anchor: 'lt' },
    })
    const readBinaryFile = vi.fn(async () => new Uint8Array([1, 2, 3]))
    const result = await collectProjectCustomBlockResources({
      root,
      packageKey: 'square',
      projectRootPath: 'D:/Cards',
      projectFonts: { body: { name: 'Body', source: 'assets/body.woff2' } },
      fs: { readBinaryFile },
    })
    expect(readBinaryFile).toHaveBeenCalledTimes(2)
    expect(result.files.size).toBe(2)
    expect(result.index.images).toHaveLength(1)
    expect(result.index.fonts).toHaveLength(1)
    rewriteProjectCustomBlockResourceReferences(root, result)
    expect(root.children[0].block.type === 'image-block' && root.children[0].block.image).toMatch(/^resource:image:/)
    expect(root.children[1].block.type === 'text-block' && root.children[1].block.fontFamily).toContain('resource:font:body')
  })

  it('rejects missing project fonts', async () => {
    const root = createBlock('text-block', { fontFamily: 'font:missing' })
    await expect(collectProjectCustomBlockResources({
      root,
      packageKey: 'missing-font',
      projectRootPath: 'D:/Cards',
      fs: { readBinaryFile: vi.fn(async () => new Uint8Array([1, 2, 3])) },
    })).rejects.toThrow('font:missing')
  })

  it('uses one resource index entry for images with identical bytes', async () => {
    const root = createBlock('simple-container-block')
    root.children.push({
      block: createBlock('image-block', { image: 'assets/first.png' }),
      location: { id: 'first', type: 'simple-container-location', anchor: 'lt' },
    }, {
      block: createBlock('image-block', { image: 'assets/second.jpg' }),
      location: { id: 'second', type: 'simple-container-location', anchor: 'lt' },
    })

    const result = await collectProjectCustomBlockResources({
      root,
      packageKey: 'images',
      projectRootPath: 'D:/Cards',
      fs: { readBinaryFile: vi.fn(async () => new Uint8Array([4, 5, 6])) },
    })

    expect(result.index.images).toHaveLength(1)
    expect(result.files.size).toBe(1)
    expect(new Set(result.imageSources.values()).size).toBe(1)
  })

  it('repackages image bytes from an expanded custom block catalog entry', async () => {
    const root = createBlock('image-block', { id: 'nested', image: 'resource:image:image' })
    const bytes = new Uint8Array([7, 8, 9])
    const result = await collectProjectCustomBlockResources({
      root,
      packageKey: 'outer',
      projectRootPath: 'D:/Cards',
      fs: { readBinaryFile: vi.fn() },
      customBlockCatalog: new Map([['picture', {
        manifest: { customBlockKey: 'picture', resources: { images: [{ key: 'image', source: 'resources/images/image.png' }] } },
        files: new Map([['resources/images/image.png', bytes]]),
      }]]),
      resourceOwners: new Map([[customBlockResourceOwnerIdentity('nested', 'image'), 'picture']]),
    })

    expect(result.files.size).toBe(1)
    expect(result.index.images).toHaveLength(1)
  })

  it('packs only referenced icon crops and rewrites rich-text icon identities', async () => {
    const root = createBlock('text-block', {
      content: '<p><span data-oc-icon-series="items" data-oc-icon-key="sword">[[icon:items/sword]]</span></p>',
    })
    const atlasBytes = new Uint8Array([8, 9, 10])
    const result = await collectProjectCustomBlockResources({
      root,
      packageKey: 'weapon',
      projectRootPath: 'D:/Cards',
      fs: { readBinaryFile: vi.fn(async () => new Uint8Array([1, 2, 3])) },
      projectIconCatalog: {
        series: [], errors: [], entries: [{
          seriesKey: 'items', source: 'assets/icons.png', src: 'asset://icons',
          imageWidth: 64, imageHeight: 64,
          iconKey: 'sword', name: 'Sword', x: 4, y: 8, width: 16, height: 24,
        }],
      },
      composeIconAtlas: vi.fn(async (entries: readonly ProjectIconCatalogEntry[]) => ({
        bytes: atlasBytes,
        width: 16,
        height: 24,
        icons: entries.map((entry, index) => ({
          iconKey: `icon-${index + 1}`, name: entry.name, x: 0, y: 0,
          width: entry.width, height: entry.height,
        })),
      })),
    })

    expect(result.files.get(result.index.iconSeries![0]!.source)).toEqual(atlasBytes)
    expect(result.index.iconSeries).toMatchObject([{ key: 'icons', icons: [{ iconKey: 'icon-1' }] }])
    rewriteProjectCustomBlockResourceReferences(root, result)
    expect(root.content).toContain('data-oc-icon-series="icons"')
    expect(root.content).toContain('[[icon:icons/icon-1]]')
  })
})
