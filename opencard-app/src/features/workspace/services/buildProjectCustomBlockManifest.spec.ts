import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest, buildProjectCustomBlockRoot } from './buildProjectCustomBlockManifest'

describe('buildProjectCustomBlockManifest', () => {
  it('projects only exposed root fields and keeps the blueprint tree', async () => {
    const root = createBlock('text-block', { width: '{{self:size}}', height: '{{self:size}}' })
    root.additionalFieldDefinition = {
      size: { fieldType: 'number', title: '尺寸' },
      label: { fieldType: 'string', title: '标签' },
    }
    ;(root as unknown as Record<string, unknown>).size = '120'
    const manifest = await buildProjectCustomBlockManifest({ root, key: 'square', exposedFieldKeys: ['size'] })
    expect(manifest).toMatchObject({ customBlockKey: 'square', publicFieldKeys: ['name', 'notes', 'size'] })
    expect(manifest.resize).toEqual({ widthLocked: true, heightLocked: true })
  })

  it('removes editor packaging state without removing container children', async () => {
    const root = createBlock('simple-container-block', { packaged: 'true' })
    root.children.push({
      block: createBlock('flow-container-block', { packaged: 'true' }),
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    })

    await buildProjectCustomBlockManifest({ root, key: 'container' })
    const block = buildProjectCustomBlockRoot(root)

    expect(block).not.toHaveProperty('packaged')
    if (block.type !== 'simple-container-block') throw new Error('Expected container')
    expect(block.children).toHaveLength(1)
    expect(block.children[0]!.block).not.toHaveProperty('packaged')
  })

  it('uses the explicitly exposed standard dimensions as the resize policy', async () => {
    const root = createBlock('text-block')
    const manifest = await buildProjectCustomBlockManifest({
      root, key: 'sized', resize: { widthLocked: true, heightLocked: false },
    })
    expect(manifest.publicFieldKeys).toEqual(['name', 'notes'])
    expect(manifest.resize).toEqual({ widthLocked: true, heightLocked: false })
  })

  it('allows an editable native root field to be public', async () => {
    const root = createBlock('text-block', { content: 'Default' })
    const manifest = await buildProjectCustomBlockManifest({ root, key: 'text', exposedFieldKeys: ['content'] })
    expect(manifest.publicFieldKeys).toEqual(['name', 'notes', 'content'])
  })

  it('normalizes exported field definitions to the portable contract', async () => {
    const root = createBlock('text-block')
    ;(root as unknown as Record<string, unknown>).additionalFieldDefinition = {
      size: { fieldType: 'number', title: 'Size', editorOnly: false },
      invalid: false,
    }

    const block = buildProjectCustomBlockRoot(root)

    expect(block.additionalFieldDefinition).toEqual({
      size: { fieldType: 'number', title: 'Size' },
    })
  })

  it('rejects an exposed field that cannot be normalized', async () => {
    const root = createBlock('text-block')
    ;(root as unknown as Record<string, unknown>).additionalFieldDefinition = { broken: false }

    await expect(buildProjectCustomBlockManifest({ root, key: 'invalid', exposedFieldKeys: ['broken'] }))
      .rejects.toThrow('not available on the root')
  })
})
