import { describe, expect, it } from 'vitest'
import {
  createBlockAdditionalField,
  createTextBlock,
  deleteBlockAdditionalField,
  type CardDocument,
  type CardInstanceRecord,
} from '../../entities/card/model'
import { applyInstance } from '../../entities/card/instance'
import { resolveReferences } from './resolveCardBindings'

function createDocument(block = createTextBlock({ id: 'text', content: '' })): CardDocument {
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
        type: 'card-face',
        id: 'front',
        background: '#FFFFFF',
        children: [{
          block,
          location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
        }],
      },
      back: { type: 'card-face', id: 'back', background: '#000000', children: [] },
    },
  }
}

describe('card additional fields and bindings', () => {
  it('resolves current-block additional fields into string and number targets', () => {
    const block = createTextBlock({ id: 'text', content: '{{self:label}}' })
    block.additionalFieldDefinition = {
      label: { fieldType: 'string', title: 'Label' },
      strength: { fieldType: 'number' },
    }
    ;(block as unknown as Record<string, unknown>).label = 'Power'
    ;(block as unknown as Record<string, unknown>).strength = '0.5'
    ;(block as unknown as Record<string, unknown>).opacity = '{{self:strength}}'

    const result = resolveReferences(createDocument(block))
    const resolved = result.document.faces.front.children[0]!.block

    expect(result.issues).toEqual([])
    expect(resolved).toMatchObject({ content: 'Power', opacity: '0.5' })
    expect(resolved.additionalFieldDefinition).toEqual(block.additionalFieldDefinition)
    expect(resolved.additionalFieldDefinition).not.toBe(block.additionalFieldDefinition)
  })

  it('treats a reference without a colon as a current-block field', () => {
    const block = createTextBlock({ id: 'text', content: '{{label}}' })
    block.additionalFieldDefinition = { label: { fieldType: 'string' } }
    ;(block as unknown as Record<string, unknown>).label = 'Short form'

    const result = resolveReferences(createDocument(block))

    expect(result.issues).toEqual([])
    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: 'Short form' })
  })

  it('fully expands dictionary values in the original block context', () => {
    const block = createTextBlock({ id: 'text', content: '{{dictionary:greeting}}' })
    block.additionalFieldDefinition = { name: { fieldType: 'string' } }
    ;(block as unknown as Record<string, unknown>).name = 'OpenCard'

    const result = resolveReferences(createDocument(block), {
      dictionary: { greeting: 'Hello {{name}}' },
    })

    expect(result.issues).toEqual([])
    expect(result.document.faces.front.children[0]!.block).toMatchObject({
      content: 'Hello OpenCard',
    })
  })

  it('renders an escaped binding opener as literal text', () => {
    const block = createTextBlock({
      id: 'text',
      content: '\\{{name}} / {{name}} / {{dictionary:literal}}',
    })
    block.additionalFieldDefinition = { name: { fieldType: 'string' } }
    ;(block as unknown as Record<string, unknown>).name = 'OpenCard'

    const result = resolveReferences(createDocument(block), {
      dictionary: { literal: '\\{{name}}' },
    })

    expect(result.issues).toEqual([])
    expect(result.document.faces.front.children[0]!.block).toMatchObject({
      content: '{{name}} / OpenCard / {{name}}',
    })
  })

  it('fully expands nested dictionary and project references', () => {
    const block = createTextBlock({ id: 'text', content: '{{dictionary:heading}}' })

    const result = resolveReferences(createDocument(block), {
      project: { name: 'Demo', description: '', version: '' },
      dictionary: {
        heading: '{{dictionary:prefix}} / {{project:name}}',
        prefix: 'Welcome',
      },
    })

    expect(result.issues).toEqual([])
    expect(result.document.faces.front.children[0]!.block).toMatchObject({
      content: 'Welcome / Demo',
    })
  })

  it('reports dictionary cycles without partially replacing the owner field', () => {
    const block = createTextBlock({ id: 'text', content: '{{dictionary:first}}' })

    const result = resolveReferences(createDocument(block), {
      dictionary: {
        first: '{{dictionary:second}}',
        second: '{{dictionary:first}}',
      },
    })

    expect(result.document.faces.front.children[0]!.block).toMatchObject({
      content: '{{dictionary:first}}',
    })
    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.cycle',
      token: '{{dictionary:first}}',
      parameters: {
        ownerType: 'dictionary',
        referencedFieldKey: 'first',
      },
    }))
  })

  it('rejects incompatible and explicitly hidden references', () => {
    const block = createTextBlock({ id: 'text', content: '{{self:type}}' })
    block.additionalFieldDefinition = { label: { fieldType: 'string' } }
    ;(block as unknown as Record<string, unknown>).label = 'not-a-number'
    ;(block as unknown as Record<string, unknown>).opacity = '{{self:label}}'

    const result = resolveReferences(createDocument(block))

    expect(result.issues.map((issue) => issue.type)).toEqual(expect.arrayContaining([
      'card-designer.binding.field-not-allowed',
      'card-designer.binding.type-mismatch',
    ]))
  })

  it('rejects mixed interpolation for non-string targets and detects additional-field cycles', () => {
    const block = createTextBlock({ id: 'text', content: '{{self:first}}' })
    block.additionalFieldDefinition = {
      first: { fieldType: 'string' },
      second: { fieldType: 'string' },
      strength: { fieldType: 'number' },
    }
    ;(block as unknown as Record<string, unknown>).first = '{{self:second}}'
    ;(block as unknown as Record<string, unknown>).second = '{{self:first}}'
    ;(block as unknown as Record<string, unknown>).strength = '0.5'
    ;(block as unknown as Record<string, unknown>).opacity = '0.{{self:strength}}'

    const result = resolveReferences(createDocument(block))

    expect(result.issues.map((issue) => issue.type)).toEqual(expect.arrayContaining([
      'card-designer.binding.type-mismatch',
      'card-designer.binding.cycle',
    ]))
  })

  it('allows schema-external scalar fields by default', () => {
    const block = createTextBlock({ id: 'text', content: '{{self:externalValue}}' })
    ;(block as unknown as Record<string, unknown>).externalValue = 'External'

    const result = resolveReferences(createDocument(block))

    expect(result.issues).toEqual([])
    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: 'External' })
  })

  it('projects additional field overrides directly onto the block root', () => {
    const block = createTextBlock({ id: 'text', content: '{{self:score}}' })
    block.additionalFieldDefinition = { score: { fieldType: 'number' } }
    ;(block as unknown as Record<string, unknown>).score = '10'
    const document = createDocument(block)
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { score: '24' } },
    }

    const projected = applyInstance(document, instance)
    const projectedBlock = projected.faces.front.children[0]!.block

    expect((projectedBlock as unknown as Record<string, unknown>).score).toBe('24')
    expect(projectedBlock.additionalFieldDefinition?.score).toEqual({ fieldType: 'number' })
    expect(resolveReferences(projected).document.faces.front.children[0]!.block).toMatchObject({ content: '24' })
  })

  it('validates creation and clears instance overrides when deleting', () => {
    const block = createTextBlock({ id: 'text' })
    const document = createDocument(block)
    document.instances = [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: '1',
      data: { text: { score: '8' } },
    }]

    expect(createBlockAdditionalField(block, '1bad', 'number')).toBe('invalid')
    expect(createBlockAdditionalField(block, 'content', 'number')).toBe('duplicate')
    expect(createBlockAdditionalField(block, 'score', 'number', 'Score')).toBeNull()
    expect(block.additionalFieldDefinition?.score).toEqual({ fieldType: 'number', title: 'Score' })
    expect((block as unknown as Record<string, unknown>).score).toBe('0')
    expect(deleteBlockAdditionalField(document, block, 'score')).toBe(1)
    expect(block.additionalFieldDefinition).toBeUndefined()
    expect((block as unknown as Record<string, unknown>).score).toBeUndefined()
    expect(document.instances[0]!.data.text).toBeUndefined()
  })

  it('keeps existing expressions diagnostic after deleting their custom field', () => {
    const block = createTextBlock({ id: 'text', content: '{{self:score}}' })
    block.additionalFieldDefinition = { score: { fieldType: 'number' } }
    ;(block as unknown as Record<string, unknown>).score = '10'
    const document = createDocument(block)

    deleteBlockAdditionalField(document, block, 'score')
    const result = resolveReferences(document)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'card-designer.binding.field-not-found',
        severity: 'warning',
        token: '{{self:score}}',
        location: expect.objectContaining({
          documentId: 'document',
          instanceId: null,
          owner: { kind: 'block', id: 'text' },
          blockId: 'text',
          fieldKey: 'content',
        }),
      }),
    ]))
  })

  it('records the zero-based character offset of the failing binding token', () => {
    const block = createTextBlock({ id: 'text', content: '😀 Hello {{self:missing}}!' })
    const result = resolveReferences(createDocument(block))

    expect(result.issues).toContainEqual(expect.objectContaining({
      type: 'card-designer.binding.field-not-found',
      token: '{{self:missing}}',
      location: expect.objectContaining({
        fieldKey: 'content',
        characterOffset: 8,
      }),
    }))
  })

  it('resolves same-face and opposite-face properties within each face subtree', () => {
    const document = createDocument(createTextBlock({ id: 'front-text', content: '{{face:background}} / {{opposite:background}}' }))
    document.faces.back.children = [{
      block: createTextBlock({ id: 'back-text', content: '{{face:background}} / {{opposite:background}}' }),
      location: { id: 'back-location', type: 'simple-container-location', anchor: 'lt' },
    }]

    const result = resolveReferences(document)

    expect(result.issues).toEqual([])
    expect(result.document.faces.front.children[0]!.block).toMatchObject({ content: '#FFFFFF / #000000' })
    expect(result.document.faces.back.children[0]!.block).toMatchObject({ content: '#000000 / #FFFFFF' })
  })

  it('rejects face references from project-only document fields and detects cross-face cycles', () => {
    const document = createDocument()
    document.name = '{{face:background}}'
    document.faces.front.background = '{{opposite:background}}'
    document.faces.back.background = '{{opposite:background}}'

    const result = resolveReferences(document)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'card-designer.binding.field-not-allowed',
        location: expect.objectContaining({ owner: { kind: 'document', id: 'document' }, faceKey: null }),
        parameters: { referencedScope: 'current-face' },
      }),
      expect.objectContaining({
        type: 'card-designer.binding.cycle',
        location: expect.objectContaining({ faceKey: expect.stringMatching(/front|back/) }),
      }),
    ]))
  })
})
