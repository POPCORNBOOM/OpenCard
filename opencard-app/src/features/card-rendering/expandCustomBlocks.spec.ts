import { describe, expect, it } from 'vitest'
import { createBlock, type CardDocument } from '../../entities/card/model'
import { expandCustomBlocks } from './expandCustomBlocks'

function documentWith(block: ReturnType<typeof createBlock>): CardDocument {
  return {
    type: 'card-document', id: 'document', version: '1', width: '100', height: '100', instances: [],
    faces: {
      front: { type: 'card-face', id: 'front', background: '', children: [{ block, location: { type: 'simple-container-location', id: 'location', anchor: 'lt' } }] },
      back: { type: 'card-face', id: 'back', background: '', children: [] },
    },
  }
}

describe('expandCustomBlocks', () => {
  it('namespaces descendant block and location ids per instance', () => {
    const root = createBlock('simple-container-block', { id: 'root' })
    root.children.push({
      block: createBlock('text-block', { id: 'label' }),
      location: { id: 'label-location', type: 'simple-container-location', anchor: 'lt' },
    })
    const first = createBlock('custom-block', { id: 'first', customBlockKey: 'item' })
    const second = createBlock('custom-block', { id: 'second', customBlockKey: 'item' })
    const document: CardDocument = {
      type: 'card-document', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [
          { block: first, location: { id: 'first-loc', type: 'simple-container-location', anchor: 'lt' } },
          { block: second, location: { id: 'second-loc', type: 'simple-container-location', anchor: 'lt' } },
        ] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map([['item', {
      manifest: { customBlockKey: 'item', publicFieldKeys: [], resize: { widthLocked: false, heightLocked: false } },
      block: root,
    }]]))
    const [a, b] = result.document.faces.front.children.map(child => child.block)
    expect(a.type === 'simple-container-block' && a.children[0].block.id).toBe('first::block:label')
    expect(b.type === 'simple-container-block' && b.children[0].block.id).toBe('second::block:label')
    expect(a.type === 'simple-container-block' && a.children[0].location.id).toBe('first::location:label-location')
  })

  it('keeps packaged image identities for the renderer resource boundary', () => {
    const root = createBlock('image-block', { image: 'resource:image:picture' })
    const host = createBlock('custom-block', { customBlockKey: 'picture' })
    const document: CardDocument = {
      type: 'card-document', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [{ block: host, location: { id: 'loc', type: 'simple-container-location', anchor: 'lt' } }] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map([['picture', {
      manifest: { customBlockKey: 'picture', publicFieldKeys: [], resize: { widthLocked: false, heightLocked: false } },
      block: root,
      resourceUrls: new Map([['resources/images/a.png', 'blob:picture']]),
    }]]))
    const expanded = result.document.faces.front.children[0].block
    expect(expanded.type === 'image-block' && expanded.image)
      .toBe('resource:image:picture')
  })

  it('reports missing packages without removing the host block', () => {
    const host = createBlock('custom-block', { customBlockKey: 'missing' })
    const document: CardDocument = {
      type: 'card-document', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [{ block: host, location: { id: 'loc', type: 'simple-container-location', anchor: 'lt' } }] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map())
    expect(result.document.faces.front.children[0].block.type).toBe('custom-block')
    expect(result.issues).toEqual([{ blockId: host.id, faceKey: 'front', reason: 'missing', customBlockKey: 'missing' }])
  })

  it('injects public values and preserves the host id', () => {
    const root = createBlock('text-block', { content: '{{self:size}}', visible: 'true' })
    root.additionalFieldDefinition = { size: { fieldType: 'number' } }
    const host = createBlock('custom-block', { customBlockKey: 'square', visible: 'false' })
    ;(host as Record<string, unknown>).size = '80'
    const document: CardDocument = {
      type: 'card-document', id: 'document', version: '1', width: '100', height: '100', instances: [],
      faces: {
        front: { type: 'card-face', id: 'front', background: '', children: [{ block: host, location: { id: 'loc', type: 'simple-container-location', anchor: 'lt' } }] },
        back: { type: 'card-face', id: 'back', background: '', children: [] },
      },
    }
    const result = expandCustomBlocks(document, new Map([
      ['square', {
        manifest: {
          customBlockKey: 'square', publicFieldKeys: ['size', 'visible'],
          resize: { widthLocked: false, heightLocked: false },
        },
        block: root,
      }],
    ]))
    const expanded = result.document.faces.front.children[0].block
    expect(expanded.id).toBe(host.id)
    expect(expanded.type).toBe('text-block')
    expect(expanded.visible).toBe('false')
    expect((expanded as { content: string }).content).toBe('{{self:size}}')
  })

  it('applies selected native fields without applying private native fields', () => {
    const host = createBlock('custom-block', { id: 'host', name: 'Private host name', customBlockKey: 'label' })
    Object.assign(host, { content: 'Public content' })
    const root = createBlock('text-block', { id: 'root', name: 'Package name', content: 'Package content' })
    const document = documentWith(host)
    const result = expandCustomBlocks(document, new Map([['label', {
      manifest: { customBlockKey: 'label', publicFieldKeys: ['content'], resize: { widthLocked: true, heightLocked: true } },
      block: root,
    }]]))
    const expanded = result.document.faces.front.children[0]!.block
    expect(expanded).toMatchObject({ content: 'Public content', name: 'Package name' })
  })
})
