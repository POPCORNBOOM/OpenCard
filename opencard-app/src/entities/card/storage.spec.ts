import { describe, expect, it } from 'vitest'
import type { CardDocument } from './model'
import { normalizeCardDocument, serializeCardDocument } from './storage'

function createDocument(): CardDocument {
  return {
    type: 'card-document', id: 'document', name: 'Document', version: '1', width: '540', height: '850',
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#fff',
        children: [{
          block: {
            type: 'text-block', id: 'text', content: 'Hello',
            additionalFieldDefinition: { score: { fieldType: 'number', title: 'Score' } }, score: '12',
          } as any,
          location: { type: 'simple-container-location', id: 'location', anchor: 'lt', x: '0', y: '0' },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#000', children: [] },
    },
    instances: [{ type: 'card-instance', id: 'instance', name: 'Instance', amount: '1', data: { text: { score: '24' } } }],
  }
}

describe('card document storage projection', () => {
  it('writes only the current model without a schema version', () => {
    const source = createDocument() as unknown as Record<string, unknown>
    source.schemaVersion = 'old'
    source.extra = true
    const serialized = serializeCardDocument(normalizeCardDocument(source).document)

    expect(JSON.parse(serialized)).not.toHaveProperty('schemaVersion')
    expect(JSON.parse(serialized)).not.toHaveProperty('extra')
  })

  it('fills missing document, face, Block, Location and Instance fields', () => {
    const result = normalizeCardDocument({
      faces: { front: { children: [{ block: { type: 'text-block' }, location: {} }] } },
      instances: [{}],
    })

    expect(result.document.type).toBe('card-document')
    expect(result.document.faces.front.type).toBe('card-face')
    expect(result.document.faces.back.type).toBe('card-face')
    expect(result.document.faces.front.children[0]?.block.type).toBe('text-block')
    expect(result.document.faces.front.children[0]?.location.type).toBe('simple-container-location')
    expect(result.document.instances[0]?.type).toBe('card-instance')
  })

  it('ignores unknown Blocks and invalid collection entries without losing siblings', () => {
    const source = createDocument() as unknown as Record<string, unknown>
    const faces = source.faces as Record<string, Record<string, unknown>>
    const children = faces.front!.children as unknown[]
    children.unshift({ block: { type: 'future-block', id: 'future' }, location: {} }, null)
    source.instances = [null, ...(source.instances as unknown[])]

    const result = normalizeCardDocument(source)
    expect(result.document.faces.front.children.map(child => child.block.id)).toEqual(['text'])
    expect(result.document.faces.back.children).toEqual([])
    expect(result.document.instances.map(instance => instance.id)).toEqual(['instance'])
    expect(result.warnings.some(warning => warning.path.includes('children'))).toBe(true)
  })

  it('ignores malformed extension definitions and keeps valid declared fields', () => {
    const source = createDocument() as unknown as Record<string, unknown>
    const block = ((source.faces as any).front.children[0].block) as Record<string, unknown>
    block.additionalFieldDefinition = {
      score: { fieldType: 'number', title: 'Score' },
      broken: { datatype: 'number' },
    }
    block.broken = 'discard me'

    const normalized = normalizeCardDocument(source).document
    const stored = JSON.parse(serializeCardDocument(normalized))
    expect(stored.faces.front.children[0].block.score).toBe('12')
    expect(stored.faces.front.children[0].block).not.toHaveProperty('broken')
  })

  it('keeps custom instance extras in memory and writes only resolvable public fields', () => {
    const source = createDocument() as unknown as Record<string, unknown>
    const block = ((source.faces as any).front.children[0].block) as Record<string, unknown>
    Object.assign(block, { type: 'custom-block', customBlockKey: 'badge', title: 'Visible', source: 'old', mystery: 'value' })
    const normalized = normalizeCardDocument(source).document
    const projected = normalized.faces.front.children[0]!.block as unknown as Record<string, unknown>
    expect(projected.mystery).toBe('value')

    const stored = JSON.parse(serializeCardDocument(normalized, {
      resolveCustomBlockPublicFieldKeys: () => ['title'],
    }))
    expect(stored.faces.front.children[0].block.title).toBe('Visible')
    expect(stored.faces.front.children[0].block).not.toHaveProperty('source')
    expect(stored.faces.front.children[0].block).not.toHaveProperty('mystery')
  })

  it('hard-fails only when the root cannot form a document', () => {
    expect(() => normalizeCardDocument(null)).toThrow('JSON object')
  })
})
