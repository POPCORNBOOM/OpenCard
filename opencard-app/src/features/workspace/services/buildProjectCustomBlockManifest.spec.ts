import { describe, expect, it } from 'vitest'
import { createBlock } from '../../../entities/card/model'
import { buildProjectCustomBlockManifest } from './buildProjectCustomBlockManifest'

describe('buildProjectCustomBlockManifest', () => {
  it('projects only exposed root fields and keeps the blueprint tree', async () => {
    const root = createBlock('text-block', { width: '{{self:size}}', height: '{{self:size}}' })
    root.additionalFieldDefinition = {
      size: { fieldType: 'number', title: '尺寸' },
      label: { fieldType: 'string', title: '标签' },
    }
    ;(root as unknown as Record<string, unknown>).size = '120'
    const manifest = await buildProjectCustomBlockManifest({ root, key: 'square', exposedFieldKeys: ['size'] })
    expect(manifest.publicFields).toEqual([{ key: 'size', fieldType: 'number', title: '尺寸', defaultValue: '120' }])
    expect(manifest.resize).toEqual({ widthLocked: true, heightLocked: true })
    expect(manifest.root).not.toBe(root)
  })

  it('removes editor packaging state without removing container children', async () => {
    const root = createBlock('simple-container-block', { packaged: 'true' })
    root.children.push({
      block: createBlock('flow-container-block', { packaged: 'true' }),
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    })

    const manifest = await buildProjectCustomBlockManifest({ root, key: 'container' })

    expect(manifest.root).not.toHaveProperty('packaged')
    if (manifest.root.type !== 'simple-container-block') throw new Error('Expected container')
    expect(manifest.root.children).toHaveLength(1)
    expect(manifest.root.children[0]!.block).not.toHaveProperty('packaged')
  })
})
