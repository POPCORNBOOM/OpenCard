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
      projectFonts: {
        body: {
          kind: 'family',
          name: 'Body',
          family: {
            key: 'body',
            name: 'Body',
            files: { normal: { upright: 'fonts/body.woff2' } },
          },
        },
      },
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

  it('packages every face and the ordered members of a project font composition', async () => {
    const root = createBlock('text-block', { fontFamily: 'font:display' })
    const readBinaryFile = vi.fn(async (path: string) => new TextEncoder().encode(path))
    const result = await collectProjectCustomBlockResources({
      root,
      packageKey: 'display-card',
      projectRootPath: 'D:/Cards',
      projectFonts: {
        latin: {
          kind: 'family', name: 'Latin', family: {
            key: 'latin', name: 'Latin', files: { normal: { upright: 'fonts/latin-regular.woff2' }, bold: { upright: 'fonts/latin-bold.woff2' } },
          },
        },
        cjk: {
          kind: 'family', name: 'CJK', family: {
            key: 'cjk', name: 'CJK', files: { normal: { upright: 'fonts/cjk.otf' } },
          },
        },
        display: {
          kind: 'composition', name: 'Display', composition: {
            key: 'display', name: 'Display', members: [
              { fontKey: 'latin', ranges: [{ start: 0x20, end: 0x7e }] },
              { fontKey: 'cjk' },
            ],
          },
        },
      },
      fs: { readBinaryFile },
    })

    expect(readBinaryFile).toHaveBeenCalledTimes(3)
    expect(result.files.size).toBe(3)
    expect(result.index.fonts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'font', key: 'latin', files: expect.objectContaining({ bold: expect.objectContaining({ upright: expect.any(String) }) }) }),
      expect.objectContaining({ kind: 'font', key: 'cjk' }),
      expect.objectContaining({ kind: 'composition', key: 'display', members: [
        { fontKey: 'latin', ranges: [{ start: 0x20, end: 0x7e }] },
        { fontKey: 'cjk' },
      ] }),
    ]))
    rewriteProjectCustomBlockResourceReferences(root, result)
    expect(root.fontFamily).toBe('resource:font:display')
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
      content: '<p><span data-oc-icon-path="items/sword"></span></p>',
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
    expect(root.content).toContain('data-oc-icon-path="icons/icon-1"')
    expect(root.content).not.toContain('[[icon:')
  })
})
