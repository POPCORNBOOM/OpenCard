import { describe, expect, it } from 'vitest'
import { createBlock, type CardDocument } from '../../entities/card/model'
import { expandCustomBlocks } from './expandCustomBlocks'

describe('expandCustomBlocks', () => {
  it('reports missing packages without removing the host block', () => {
    const host = createBlock('custom-block', { source: 'block:missing', interfaceHash: 'hash' })
    const document: CardDocument = {
      type: 'card-document', schemaVersion: '2', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [{ block: host, location: { id: 'loc', type: 'simple-container-location', anchor: 'lt' } }] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map())
    expect(result.document.faces.front.children[0].block.type).toBe('custom-block')
    expect(result.issues).toEqual([{ blockId: host.id, faceKey: 'front', reason: 'missing', source: 'block:missing' }])
  })

  it('injects public values and preserves the host id', () => {
    const root = createBlock('text-block', { content: '{{self:size}}' })
    const host = createBlock('custom-block', { source: 'block:square', interfaceHash: 'hash' })
    ;(host as Record<string, unknown>).size = '80'
    const document: CardDocument = {
      type: 'card-document', schemaVersion: '2', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [{ block: host, location: { id: 'loc', type: 'simple-container-location', anchor: 'lt' } }] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map([
      ['square', {
        manifest: {
          key: 'square', interfaceHash: 'hash', root,
          publicFields: [{ key: 'size', fieldType: 'number' }],
          resize: { widthLocked: false, heightLocked: false },
        },
      }],
    ]))
    const expanded = result.document.faces.front.children[0].block
    expect(expanded.id).toBe(host.id)
    expect(expanded.type).toBe('text-block')
    expect((expanded as { content: string }).content).toBe('{{self:size}}')
  })
})
