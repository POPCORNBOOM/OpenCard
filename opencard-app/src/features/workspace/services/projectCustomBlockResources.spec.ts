import { describe, expect, it, vi } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { collectProjectCustomBlockResources, rewriteProjectCustomBlockResourceReferences } from './projectCustomBlockResources'
import type { ProjectIconCatalogEntry } from './projectIconCatalog'

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
    rewriteProjectCustomBlockResourceReferences(root, 'square', result)
    expect(root.children[0].block.type === 'image-block' && root.children[0].block.image).toMatch(/^ocblock:square\//)
    expect(root.children[1].block.type === 'text-block' && root.children[1].block.fontFamily).toContain('OpenCardCustomBlock-square-body')
  })

  it('rejects missing project fonts', async () => {
    const root = createBlock('text-block', { fontFamily: 'font:missing' })
    await expect(collectProjectCustomBlockResources({
      root,
      packageKey: 'missing-font',
      projectRootPath: 'D:/Cards',
      fs: { readBinaryFile: vi.fn() },
    })).rejects.toThrow('font:missing')
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
      fs: { readBinaryFile: vi.fn() },
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
    expect(result.index.iconSeries).toMatchObject([{ key: 'ocblock-weapon', icons: [{ iconKey: 'icon-1' }] }])
    rewriteProjectCustomBlockResourceReferences(root, 'weapon', result)
    expect(root.content).toContain('data-oc-icon-series="ocblock-weapon"')
    expect(root.content).toContain('[[icon:ocblock-weapon/icon-1]]')
  })
})
