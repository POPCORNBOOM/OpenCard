import { describe, expect, it } from 'vitest'
import { createBlock, type CardDocument } from '../../entities/card/model'
import { expandCustomBlocks } from './expandCustomBlocks'

describe('expandCustomBlocks', () => {
  it('namespaces descendant block and location ids per instance', () => {
    const root = createBlock('simple-container-block', { id: 'root' })
    root.children.push({
      block: createBlock('text-block', { id: 'label' }),
      location: { id: 'label-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const first = createBlock('custom-block', { id: 'first', source: 'block:item', interfaceHash: 'hash' })
    const second = createBlock('custom-block', { id: 'second', source: 'block:item', interfaceHash: 'hash' })
    const document: CardDocument = {
      type: 'card-document', schemaVersion: '2', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [
          { block: first, location: { id: 'first-loc', type: 'simple-container-location', anchor: 'lt' } },
          { block: second, location: { id: 'second-loc', type: 'simple-container-location', anchor: 'lt' } },
        ] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map([['item', {
      manifest: { key: 'item', interfaceHash: 'hash', root, publicFields: [], resize: { widthLocked: false, heightLocked: false } },
    }]]))
    const [a, b] = result.document.faces.front.children.map(child => child.block)
    expect(a.type === 'simple-container-block' && a.children[0].block.id).toBe('first::block:label')
    expect(b.type === 'simple-container-block' && b.children[0].block.id).toBe('second::block:label')
    expect(a.type === 'simple-container-block' && a.children[0].location.id).toBe('first::location:label-location')
  })

  it('resolves packaged images through their controlled runtime URL', () => {
    const root = createBlock('image-block', { image: 'ocblock:picture/resources/images/a.png' })
    const host = createBlock('custom-block', { source: 'block:picture', interfaceHash: 'hash' })
    const document: CardDocument = {
      type: 'card-document', schemaVersion: '2', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [{ block: host, location: { id: 'loc', type: 'simple-container-location', anchor: 'lt' } }] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map([['picture', {
      manifest: { key: 'picture', interfaceHash: 'hash', root, publicFields: [], resize: { widthLocked: false, heightLocked: false } },
      resourceUrls: new Map([['resources/images/a.png', 'blob:picture']]),
    }]]))
    const expanded = result.document.faces.front.children[0].block
    expect(expanded.type === 'image-block' && expanded.image).toBe('blob:picture')
  })

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
    const root = createBlock('text-block', { content: '{{self:size}}', visible: 'true' })
    const host = createBlock('custom-block', { source: 'block:square', interfaceHash: 'hash', visible: 'false' })
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
    expect(expanded.visible).toBe('false')
    expect((expanded as { content: string }).content).toBe('{{self:size}}')
  })
})
