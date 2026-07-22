import { describe, expect, it } from 'vitest'
import { createTextBlock, type CardDocument, type CardInstanceRecord } from '../../entities/card/model'
import { runRenderPipeline } from './renderPipeline'
import {
  createDefaultProjectInformation,
  createProjectAdditionalField,
} from '../workspace/model/projectMetadata'

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

  it('resolves project fields from an explicit render context', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{g:name}}' })
    const project = createDefaultProjectInformation('OpenCard Demo')

    const result = runRenderPipeline(createDocument(block), null, { project })

    expect(result.document.children[0]!.block).toMatchObject({ content: 'OpenCard Demo' })
    expect(result.issues).toEqual([])
  })

  it('reports a missing project context without reading global state', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{g:name}}' })

    const result = runRenderPipeline(createDocument(block), null)

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.source-not-found',
      location: expect.objectContaining({ fieldKey: 'content' }),
    }))
  })

  it('preserves custom project field kinds through binding and render parsing', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: 'Demo' })
    block.opacity = '{{g:cardOpacity}}'
    const project = createDefaultProjectInformation('Demo')
    createProjectAdditionalField(project, 'cardOpacity', 'number')
    project.cardOpacity = '0.5'

    const result = runRenderPipeline(createDocument(block), null, { project })

    expect(result.document.children[0]!.block).toMatchObject({ opacity: 0.5 })
    expect(result.issues).toEqual([])
  })

  it('rejects project fields that the schema does not expose', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{g:entry}}' })
    const project = createDefaultProjectInformation('Demo')

    const result = runRenderPipeline(createDocument(block), null, { project })

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.field-not-allowed',
      parameters: expect.objectContaining({
        ownerType: 'project',
        referencedFieldKey: 'entry',
      }),
    }))
  })
})
