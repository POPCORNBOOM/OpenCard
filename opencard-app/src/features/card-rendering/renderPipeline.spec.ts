import { describe, expect, it } from 'vitest'
import { createTextBlock, type CardDocument, type CardInstanceRecord } from '../../entities/card/model'
import { runRenderPipeline } from './renderPipeline'

function createDocument(block = createTextBlock({ id: 'text', name: 'Title', content: 'Blueprint' })): CardDocument {
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
      block,
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    }],
  }
}

describe('renderPipeline', () => {
  it('applies the instance before expanding bindings and parsing render data', () => {
    const document = createDocument()
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { content: '{{d:name}}' } },
    }

    const result = runRenderPipeline(document, instance)

    expect(result.document.children[0]!.block).toMatchObject({ content: 'Document' })
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      location: expect.objectContaining({ fieldKey: 'content' }),
    }))
    expect(document.children[0]!.block).toMatchObject({ content: 'Blueprint' })
  })

  it('returns binding and render diagnostics through one ordered issue stream', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: 'Blueprint' })
    block.opacity = 'not-a-number'
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { content: '{{invalid}}' } },
    }

    const result = runRenderPipeline(createDocument(block), instance)

    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'card-designer.binding.invalid-token',
        location: expect.objectContaining({
          instanceId: 'instance',
          owner: { kind: 'block', id: 'text' },
          fieldKey: 'content',
        }),
      }),
      expect.objectContaining({
        type: 'card-designer.render-parse.conversion-failed',
        location: expect.objectContaining({
          instanceId: 'instance',
          owner: { kind: 'block', id: 'text' },
          fieldKey: 'opacity',
        }),
      }),
    ])
  })
})
