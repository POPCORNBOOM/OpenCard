import { describe, expect, it } from 'vitest'
import {
  createSimpleContainerBlock,
  createTextBlock,
  type CardBlock,
  type CardDocument,
  type CardInstanceRecord,
} from '../../entities/card/model'
import { runRenderPipeline } from './renderPipeline'
import {
  createDefaultProjectInformation,
} from '../workspace/model/projectMetadata'

function createDocument(
  block: CardBlock = createTextBlock({ id: 'text', name: 'Title', content: 'Blueprint' }),
): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    instances: [],
    faces: {
      front: {
        type: 'card-face', id: 'front', background: '#ffffff',
        children: [{ block, location: { id: 'location', type: 'simple-container-location', anchor: 'lt' } }],
      },
      back: { type: 'card-face', id: 'back', background: '#000000', children: [] },
    },
  }
}

describe('renderPipeline', () => {
  it('renders packaged and unpackaged containers identically', () => {
    const createContainer = (packaged?: string) => createSimpleContainerBlock({
      id: 'container',
      packaged,
      children: [{
        block: createTextBlock({ id: 'child', content: 'Visible content' }),
        location: { id: 'child-location', type: 'simple-container-location', anchor: 'lt' },
      }],
    })

    const unpackaged = runRenderPipeline(createDocument(createContainer()), null)
    const packaged = runRenderPipeline(createDocument(createContainer('true')), null)

    expect(packaged.document).toEqual(unpackaged.document)
    expect(packaged.issues).toEqual(unpackaged.issues)
  })

  it('applies the instance before expanding bindings and parsing render data', () => {
    const document = createDocument()
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { content: '{{document:name}}' } },
    }

    const result = runRenderPipeline(document, instance)

    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: 'Document' })
    expect(result.document.faces.back).toMatchObject({ faceKey: 'back', children: [] })
    expect(result.issues).not.toContainEqual(expect.objectContaining({
      location: expect.objectContaining({ fieldKey: 'content' }),
    }))
    expect(document.faces.front.children[0]!.block).toMatchObject({ content: 'Blueprint' })
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
        type: 'card-designer.binding.field-not-found',
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
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{project:name}}' })
    const project = createDefaultProjectInformation('OpenCard Demo')

    const result = runRenderPipeline(createDocument(block), null, { project })

    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: 'OpenCard Demo' })
    expect(result.issues).toEqual([])
  })

  it('allows document fields to bind only to project fields', () => {
    const document = createDocument()
    document.name = '{{project:name}}'
    document.description = '{{project:description}}\nCard document'
    document.notes = 'Project: {{project:name}}'
    const project = createDefaultProjectInformation('OpenCard Demo')
    project.description = 'Reusable cards'

    const result = runRenderPipeline(document, null, { project })

    expect(result.document).toMatchObject({
      name: 'OpenCard Demo',
      description: 'Reusable cards\nCard document',
      notes: 'Project: OpenCard Demo',
    })
    expect(result.issues).toEqual([])

    document.name = '{{document:version}}'
    const rejected = runRenderPipeline(document, null, { project })
    expect(rejected.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.field-not-allowed',
      location: expect.objectContaining({ fieldKey: 'name' }),
      parameters: { referencedScope: 'document' },
    }))
  })

  it('reports a missing project context without reading global state', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{project:name}}' })

    const result = runRenderPipeline(createDocument(block), null)

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.source-not-found',
      location: expect.objectContaining({ fieldKey: 'content' }),
    }))
  })

  it('resolves saved dictionary values', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{dictionary:title}}' })
    const result = runRenderPipeline(createDocument(block), null, {
      dictionary: { title: 'English title' },
    })

    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: 'English title' })
    expect(result.issues).toEqual([])
  })

  it('rejects project fields that do not exist', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{project:entry}}' })
    const project = createDefaultProjectInformation('Demo')

    const result = runRenderPipeline(createDocument(block), null, { project })

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.field-not-found',
      parameters: expect.objectContaining({
        ownerType: 'project',
        referencedFieldKey: 'entry',
      }),
    }))
  })

  it('wraps an expanded custom block around its resolved native content', () => {
    const host = createTextBlock({ id: 'host' }) as unknown as CardBlock
    Object.assign(host, { type: 'custom-block', source: 'block:label', interfaceHash: 'hash' })
    const root = createTextBlock({ id: 'root', content: '{{self:label}}' })
    root.additionalFieldDefinition = { label: { fieldType: 'string' } }
    const result = runRenderPipeline(createDocument(host), null, {
      customBlockCatalog: new Map([['label', {
        manifest: {
          key: 'label', interfaceHash: 'hash', root,
          publicFields: [{ key: 'label', fieldType: 'string', defaultValue: 'Ready' }],
          resize: { widthLocked: false, heightLocked: false },
        },
      }]]),
    })
    const rendered = result.document.faces.front.children[0]!.block

    expect(rendered).toMatchObject({
      type: 'custom-block', id: 'host', source: 'block:label',
      content: { type: 'text-block', id: 'host', content: 'Ready' },
    })
  })
})
