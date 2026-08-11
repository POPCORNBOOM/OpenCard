import { describe, expect, it } from 'vitest'
import { createSimpleContainerBlock, createTextBlock, type CardDocument } from '../../entities/card/model'
import { parseRenderDocument } from './renderParser'

function createDocument(): CardDocument {
  return {
    type: 'card-document',

    id: 'document',
    name: 'Document',
    description: 'Reusable card.',
    notes: 'Review margins.',
    version: '1.0.0',
    width: '540',
    height: '850',
    instances: [],
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#ffffff',
        children: [{
          block: createTextBlock({
            id: 'text', name: 'Title', content: 'Hello', opacity: '0.5',
          }),
          location: {
            id: 'location', type: 'simple-container-location', anchor: 'lt', x: '10', y: '20px',
          },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#000000', children: [] },
    },
  }
}

describe('renderParser', () => {
  it('creates a complete render-ready tree from sparse binding-expanded data', () => {
    const document = createDocument()
    delete (document.faces.front.children[0]!.block as unknown as Record<string, unknown>).verticalAlign

    const result = parseRenderDocument(document)
    const block = result.document.faces.front.children[0]!.block

    expect(result.document.faces.front).toMatchObject({ faceKey: 'front', width: 540, height: 850 })
    expect(result.document.faces.back).toMatchObject({ faceKey: 'back', width: 540, height: 850 })
    expect(result.document).toMatchObject({
      name: 'Document',
      version: '1.0.0',
      description: 'Reusable card.',
      notes: 'Review margins.',
    })
    expect(result.document.faces.front.children[0]!.location).toMatchObject({ x: '10px', y: '20px' })
    expect(block).toMatchObject({
      type: 'text-block',
      id: 'text',
      name: 'Title',
      notes: '',
      visible: true,
      opacity: 0.5,
      verticalAlign: 'top',
    })
    expect(result.issues).toEqual([])
  })

  it('parses block notes and visibility without materializing the source', () => {
    const document = createDocument()
    const block = document.faces.front.children[0]!.block
    block.notes = 'Shown beside the selection.'
    block.visible = 'false'
    const sourceSnapshot = structuredClone(document)

    const parsed = parseRenderDocument(document).document.faces.front.children[0]!.block

    expect(parsed).toMatchObject({ notes: 'Shown beside the selection.', visible: false })
    expect(document).toEqual(sourceSnapshot)
  })

  it('uses schema defaults for invalid values without changing the source document', () => {
    const document = createDocument()
    const block = document.faces.front.children[0]!.block
    ;(block as unknown as Record<string, unknown>).opacity = 'not-a-number'
    ;(block as unknown as Record<string, unknown>).verticalAlign = 'sideways'
    ;(block as unknown as Record<string, unknown>).color = { invalid: true }
    ;(document.faces.front.children[0]!.location as unknown as Record<string, unknown>).x = { invalid: true }
    const sourceSnapshot = structuredClone(document)

    const result = parseRenderDocument(document)
    const parsed = result.document.faces.front.children[0]!.block

    expect(parsed).toMatchObject({ opacity: 1, verticalAlign: 'top' })
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'card-designer.render-parse.conversion-failed',
        severity: 'warning',
        location: expect.objectContaining({
          owner: { kind: 'block', id: 'text' },
          faceKey: 'front',
          blockId: 'text',
          fieldKey: 'opacity',
        }),
      }),
      expect.objectContaining({
        type: 'card-designer.render-parse.invalid-option',
        location: expect.objectContaining({ blockId: 'text', fieldKey: 'verticalAlign' }),
      }),
      expect.objectContaining({
        type: 'card-designer.render-parse.invalid-type',
        location: expect.objectContaining({ blockId: 'text', fieldKey: 'color' }),
        parameters: { fieldName: 'textColor', defaultValue: '""' },
      }),
      expect.objectContaining({
        type: 'card-designer.render-parse.invalid-type',
        location: expect.objectContaining({
          owner: { kind: 'location', id: 'location' },
          blockId: 'text',
          fieldKey: 'x',
        }),
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
    document.faces.front.children[0]!.block = createSimpleContainerBlock({
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
      type: 'card-designer.render-parse.out-of-range',
      location: expect.objectContaining({
        documentId: 'document',
        instanceId: null,
        faceKey: 'front',
        blockPath: 'Group.Caption',
        blockId: 'nested-text',
        fieldKey: 'opacity',
      }),
    }))
  })
})
