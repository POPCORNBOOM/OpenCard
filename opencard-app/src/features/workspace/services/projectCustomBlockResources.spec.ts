import { describe, expect, it, vi } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { collectProjectCustomBlockResources, rewriteProjectCustomBlockResourceReferences } from './projectCustomBlockResources'

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
      projectRootPath: 'D:/Cards',
      fs: { readBinaryFile: vi.fn() },
    })).rejects.toThrow('font:missing')
  })
})
