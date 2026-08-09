import { describe, expect, it } from 'vitest'
import { createSimpleContainerBlock, createTextBlock, type CardDocument } from './model'
import { parseCardDocument, serializeCardDocument } from './storage'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: {
        type: 'card-face',
        id: 'front',
        background: '#FFFFFF',
        children: [{
          block: {
            type: 'text-block',
            id: 'text',
            name: 'Title',
            content: 'Hello',
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
      },
      back: {
        type: 'card-face',
        id: 'back',
        background: '#000000',
        children: [],
      },
    },
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
    document.dataTable = {
      blocks: { text: ['content', 'score'] },
      exportInstanceIds: ['instance'],
    }
    const serialized = serializeCardDocument(document)
    const parsed = parseCardDocument(JSON.parse(serialized))

    expect(parsed).toEqual(document)
    expect(parsed.width).toBe('540')
    expect(parsed.instances[0]?.amount).toBe('1')
    expect(parsed.dataTable?.blocks).toEqual({ text: ['content', 'score'] })
    expect(parsed.dataTable?.exportInstanceIds).toEqual(['instance'])
  })

  it('accepts sparse optional document metadata', () => {
    const document = createDocument()
    delete document.name
    document.description = 'A reusable card document.'
    document.notes = 'Review print margins.'

    expect(parseCardDocument(document)).toEqual(document)
  })

  it('round-trips packaged container state without requiring it from older documents', () => {
    const legacy = createDocument()
    expect(parseCardDocument(JSON.parse(serializeCardDocument(legacy)))).toEqual(legacy)

    const document = createDocument()
    document.faces.front.children[0]!.block = createSimpleContainerBlock({
      id: 'container',
      packaged: 'true',
      children: [{
        block: createTextBlock({ id: 'child', content: 'Visible content' }),
        location: { id: 'child-location', type: 'simple-container-location', anchor: 'lt' },
      }],
    })

    const parsed = parseCardDocument(JSON.parse(serializeCardDocument(document)))
    expect(parsed.faces.front.children[0]!.block).toMatchObject({
      id: 'container',
      packaged: 'true',
    })
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
    const faces = document.faces as Record<string, Record<string, unknown>>
    const children = faces.front?.children as Array<Record<string, unknown>>
    const block = children[0]?.block as Record<string, unknown>
    block.additionalFieldDefinition = { score: { datatype: 'number' } }

    expect(() => parseCardDocument(document)).toThrow('datatype is no longer supported')
  })

  it('rejects v1 documents instead of migrating them', () => {
    const document = createDocument() as unknown as Record<string, unknown>
    delete document.schemaVersion
    delete document.faces
    document.background = '#FFFFFF'
    document.children = []

    expect(() => parseCardDocument(document)).toThrow('$.schemaVersion must be a string')
  })

  it('requires both faces', () => {
    const document = createDocument() as unknown as Record<string, unknown>
    const faces = document.faces as Record<string, unknown>
    delete faces.back

    expect(() => parseCardDocument(document)).toThrow('$.faces.back must be an object')
  })

  it('rejects malformed data-table field selections', () => {
    const document = createDocument() as unknown as Record<string, unknown>
    document.dataTable = { blocks: { text: 'content' } }

    expect(() => parseCardDocument(document)).toThrow('$.dataTable.blocks.text must be an array')
  })

  it('rejects malformed or duplicate data-table export Instance IDs', () => {
    const malformed = createDocument() as unknown as Record<string, unknown>
    malformed.dataTable = { blocks: {}, exportInstanceIds: ['instance', ''] }
    expect(() => parseCardDocument(malformed))
      .toThrow('$.dataTable.exportInstanceIds[1] must be a non-empty string')

    const duplicate = createDocument() as unknown as Record<string, unknown>
    duplicate.dataTable = { blocks: {}, exportInstanceIds: ['instance', 'instance'] }
    expect(() => parseCardDocument(duplicate))
      .toThrow('$.dataTable.exportInstanceIds contains duplicate Instance ID instance')
  })
})
