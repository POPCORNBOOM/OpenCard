import { describe, expect, it } from 'vitest'
import type { CardDocument } from './model'
import { parseCardDocument, serializeCardDocument } from './storage'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    background: '#FFFFFF',
    children: [{
      block: {
        type: 'text-block',
        id: 'text',
        name: 'Title',
        content: 'Hello',
        mode: 'plain',
        opacity: '0.5',
        additionalFieldDefinition: {
          score: { fieldType: 'number', title: 'Score' },
        },
      },
      location: {
        type: 'simple-container-location',
        id: 'location',
        anchor: 'lt',
        x: '0',
        y: '0',
      },
    }],
    instances: [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { score: '24' } },
    }],
  }
}

describe('card document storage contract', () => {
  it('accepts strings, arrays and objects and serializes without changing scalar types', () => {
    const document = createDocument()
    const serialized = serializeCardDocument(document)
    const parsed = parseCardDocument(JSON.parse(serialized))

    expect(parsed).toEqual(document)
    expect(parsed.width).toBe('540')
    expect(parsed.instances[0]?.amount).toBe('1')
  })

  it.each([
    ['number', 540],
    ['boolean', true],
    ['null', null],
  ])('rejects %s persisted scalars', (_label, invalidValue) => {
    const document = createDocument() as unknown as Record<string, unknown>
    document.width = invalidValue

    expect(() => parseCardDocument(document)).toThrow('contains a scalar that is not a string')
  })

  it('rejects the removed datatype key', () => {
    const document = createDocument() as unknown as Record<string, unknown>
    const children = document.children as Array<Record<string, unknown>>
    const block = children[0]?.block as Record<string, unknown>
    block.additionalFieldDefinition = { score: { datatype: 'number' } }

    expect(() => parseCardDocument(document)).toThrow('datatype is no longer supported')
  })
})
