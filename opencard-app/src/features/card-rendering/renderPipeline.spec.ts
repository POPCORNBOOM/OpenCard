import { describe, expect, it } from 'vitest'
import {
  createSimpleContainerBlock,
  createTextBlock,
  type CardBlock,
  type CardDocument,
  type CardInstanceRecord,
} from '../../entities/card/model'
import { prepareCardRender, type RenderPipelineContext } from './renderPipeline'
import {
  createDefaultProjectInformation,
} from '../workspace/model/projectMetadata'
import { EMPTY_PROJECT_ICON_CATALOG } from '../workspace/services/projectIconCatalog'

function render(
  document: CardDocument,
  instance: CardInstanceRecord | null,
  context: RenderPipelineContext = {},
) {
  return prepareCardRender({
    document,
    instance,
    resourceRootPath: null,
    environment: { ...context, projectIconCatalog: EMPTY_PROJECT_ICON_CATALOG },
  })
}

function createDocument(
  block: CardBlock = createTextBlock({ id: 'text', name: 'Title', content: 'Blueprint' }),
): CardDocument {
  return {
    type: 'card-document',

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

    const unpackaged = render(createDocument(createContainer()), null)
    const packaged = render(createDocument(createContainer('true')), null)

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

    const result = render(document, instance)

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

    const result = render(createDocument(block), instance)

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

    const result = render(createDocument(block), null, { project })

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

    const result = render(document, null, { project })

    expect(result.document).toMatchObject({
      name: 'OpenCard Demo',
      description: 'Reusable cards\nCard document',
      notes: 'Project: OpenCard Demo',
    })
    expect(result.issues).toEqual([])

    document.name = '{{document:version}}'
    const rejected = render(document, null, { project })
    expect(rejected.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.field-not-allowed',
      location: expect.objectContaining({ fieldKey: 'name' }),
      parameters: { referencedScope: 'document' },
    }))
  })

  it('reports a missing project context without reading global state', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{project:name}}' })

    const result = render(createDocument(block), null)

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.source-not-found',
      location: expect.objectContaining({ fieldKey: 'content' }),
    }))
  })

  it('resolves saved dictionary values', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{dictionary:title}}' })
    const result = render(createDocument(block), null, {
      dictionary: { title: 'English title' },
    })

    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: 'English title' })
    expect(result.issues).toEqual([])
  })

  it('rejects project fields that do not exist', () => {
    const block = createTextBlock({ id: 'text', name: 'Title', content: '{{project:entry}}' })
    const project = createDefaultProjectInformation('Demo')

    const result = render(createDocument(block), null, { project })

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
    Object.assign(host, { type: 'custom-block', customBlockKey: 'label', label: 'Ready' })
    const root = createTextBlock({ id: 'root', content: '{{self:label}}' })
    root.additionalFieldDefinition = { label: { fieldType: 'string' } }
    const result = render(createDocument(host), null, {
      customBlockCatalog: new Map([['label', {
        manifest: {
          customBlockKey: 'label', publicFieldKeys: ['label'],
          resize: { widthLocked: false, heightLocked: false },
        },
        block: root,
      }]]),
    })
    const rendered = result.document.faces.front.children[0]!.block

    expect(rendered).toMatchObject({
      type: 'custom-block', id: 'host', customBlockKey: 'label',
      content: { type: 'text-block', id: 'host', content: 'Ready' },
    })
  })

  it('prepares embedded rich-text blocks once and shares the catalog with renderer resources', () => {
    const host = createTextBlock({
      id: 'host',
      content: '<p><oc-custom-block data-oc-id="badge-1" data-oc-key="badge" data-oc-layout="inline">'
        + '<oc-prop data-oc-key="label">Ready</oc-prop></oc-custom-block></p>',
    })
    const root = createTextBlock({ id: 'root', content: '{{self:label}}' })
    root.additionalFieldDefinition = { label: { fieldType: 'string' } }

    const result = render(createDocument(host), null, {
      customBlockCatalog: new Map([['badge', {
        manifest: {
          customBlockKey: 'badge', publicFieldKeys: ['label'],
          resize: { widthLocked: true, heightLocked: true },
        },
        block: root,
      }]]),
    })

    expect(result.resources.richText).toBe(result.richText)
    expect(result.resources.richText?.get('host')?.embeddedBlocks.get('badge-1'))
      .toMatchObject({ type: 'custom-block', content: { type: 'text-block', content: 'Ready' } })
  })

  it('reports packaged resource degradation on the host without exposing resource identity', () => {
    const host = createTextBlock({ id: 'host' }) as unknown as CardBlock
    Object.assign(host, { type: 'custom-block', customBlockKey: 'label' })
    const result = render(createDocument(host), null, {
      customBlockCatalog: new Map([['label', {
        manifest: {
          customBlockKey: 'label', publicFieldKeys: [], resize: { widthLocked: false, heightLocked: false },
        },
        block: createTextBlock({ id: 'root', content: 'Fallback' }),
        hasResourceErrors: true,
      }]]),
    })

    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'card-designer.custom-block.resource-error',
        location: expect.objectContaining({ owner: { kind: 'block', id: 'host' } }),
      }),
    ])
    expect(JSON.stringify(result.issues)).not.toContain('label')
    expect(JSON.stringify(result.issues)).not.toContain('hash')
  })

  it('collapses internal custom block issues onto the opaque host', () => {
    const host = createTextBlock({ id: 'host' }) as unknown as CardBlock
    Object.assign(host, { type: 'custom-block', customBlockKey: 'label' })
    const root = createSimpleContainerBlock({
      id: 'root',
      children: [{
        block: createTextBlock({ id: 'internal', name: 'Private label', content: '{{self:missing}}' }),
        location: { id: 'internal-location', type: 'simple-container-location', anchor: 'lt' },
      }],
    })

    const result = render(createDocument(host), null, {
      customBlockCatalog: new Map([['label', {
        manifest: {
          customBlockKey: 'label', publicFieldKeys: [],
          resize: { widthLocked: false, heightLocked: false },
        },
        block: root,
      }]]),
    })

    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'card-designer.custom-block.content-error',
        location: expect.objectContaining({
          owner: { kind: 'block', id: 'host' },
          blockId: 'host',
          fieldKey: 'content',
        }),
      }),
    ])
    expect(JSON.stringify(result.issues)).not.toContain('Private label')
    expect(JSON.stringify(result.issues)).not.toContain('internal')
    expect(JSON.stringify(result.issues)).not.toContain('missing')
  })

  it('reports an unavailable custom block without exposing its source', () => {
    const host = createTextBlock({ id: 'host' }) as unknown as CardBlock
    Object.assign(host, { type: 'custom-block', customBlockKey: 'private-package' })
    const result = render(createDocument(host), null)

    expect(result.issues).toEqual([
      expect.objectContaining({
        type: 'card-designer.custom-block.unavailable',
        location: expect.objectContaining({ owner: { kind: 'block', id: 'host' } }),
      }),
    ])
    expect(JSON.stringify(result.issues)).not.toContain('private-package')
    expect(JSON.stringify(result.issues)).not.toContain('secret-hash')
  })
})
