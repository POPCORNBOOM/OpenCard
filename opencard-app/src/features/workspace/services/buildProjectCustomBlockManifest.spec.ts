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
    const manifest = await buildProjectCustomBlockManifest({ root, key: 'square', exposedFieldKeys: ['size'] })
    expect(manifest.publicFields).toEqual([{ key: 'size', fieldType: 'number', title: '尺寸' }])
    expect(manifest.resize).toEqual({ widthLocked: true, heightLocked: true })
    expect(manifest.root).not.toBe(root)
  })
})
