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
    expect(result.bindingIssues).toEqual([])
    expect(result.renderIssues).not.toContainEqual(expect.objectContaining({ fieldKey: 'content' }))
    expect(document.children[0]!.block).toMatchObject({ content: 'Blueprint' })
  })

  it('preserves binding and render diagnostics separately and in pipeline order', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{invalid}}' })
    block.opacity = 'not-a-number'

    const result = runRenderPipeline(createDocument(block), null)

    expect(result.bindingIssues).toContainEqual(expect.objectContaining({ code: 'INVALID_TOKEN' }))
    expect(result.renderIssues).toContainEqual(expect.objectContaining({
      blockId: 'text',
      fieldKey: 'opacity',
      reasonCode: 'CONVERSION_FAILED',
    }))
    expect(result.issues).toEqual([...result.bindingIssues, ...result.renderIssues])
  })
})
