import { describe, expect, it } from 'vitest'
import { createSimpleContainerBlock, createTextBlock, type CardDocument } from '../../entities/card/model'
import { parseRenderDocument } from './renderParser'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    background: '#ffffff',
    instances: [],
    children: [{
      block: createTextBlock({
        id: 'text',
        name: 'Title',
        content: 'Hello',
        opacity: '0.5',
      }),
      location: {
        id: 'location',
        type: 'simple-container-location',
        anchor: 'lt',
        x: '10',
        y: '20px',
      },
    }],
  }
}

describe('renderParser', () => {
  it('creates a complete render-ready tree from sparse binding-expanded data', () => {
    const document = createDocument()
    delete (document.children[0]!.block as unknown as Record<string, unknown>).verticalAlign

    const result = parseRenderDocument(document)
    const block = result.document.children[0]!.block

    expect(result.document).toMatchObject({ width: 540, height: 850 })
    expect(result.document.children[0]!.location).toMatchObject({ x: '10px', y: '20px' })
    expect(block).toMatchObject({
      type: 'text-block',
      id: 'text',
      name: 'Title',
      opacity: 0.5,
      verticalAlign: 'top',
    })
    expect(result.issues).toContainEqual(expect.objectContaining({
      documentId: 'document',
      blockPath: 'Title',
      blockId: 'text',
      fieldKey: 'verticalAlign',
      reasonCode: 'MISSING_VALUE',
    }))
  })

  it('uses schema defaults for invalid values without changing the source document', () => {
    const document = createDocument()
    const block = document.children[0]!.block
    ;(block as unknown as Record<string, unknown>).opacity = 'not-a-number'
    ;(block as unknown as Record<string, unknown>).verticalAlign = 'sideways'
    ;(block as unknown as Record<string, unknown>).color = { invalid: true }
    const sourceSnapshot = structuredClone(document)

    const result = parseRenderDocument(document)
    const parsed = result.document.children[0]!.block

    expect(parsed).toMatchObject({ opacity: 1, verticalAlign: 'top' })
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ blockId: 'text', fieldKey: 'opacity', reasonCode: 'CONVERSION_FAILED' }),
      expect.objectContaining({ blockId: 'text', fieldKey: 'verticalAlign', reasonCode: 'INVALID_OPTION' }),
      expect.objectContaining({
        blockId: 'text',
        fieldKey: 'color',
        fieldName: 'textColor',
        reasonCode: 'INVALID_TYPE',
      }),
    ]))
    expect(document).toEqual(sourceSnapshot)
  })

  it('records nested block paths as dot-separated block names', () => {
    const document = createDocument()
    const nestedText = createTextBlock({
      id: 'nested-text',
      name: 'Caption',
      content: 'Nested',
    })
    ;(nestedText as unknown as Record<string, unknown>).opacity = '2'
    document.children[0]!.block = createSimpleContainerBlock({
      id: 'group',
      name: 'Group',
      children: [{
        block: nestedText,
        location: {
          id: 'nested-location',
          type: 'simple-container-location',
          anchor: 'lt',
          x: '0',
          y: '0',
        },
      }],
    })

    const result = parseRenderDocument(document)

    expect(result.issues).toContainEqual(expect.objectContaining({
      documentId: 'document',
      blockPath: 'Group.Caption',
      blockId: 'nested-text',
      fieldKey: 'opacity',
      reasonCode: 'OUT_OF_RANGE',
    }))
  })
})
