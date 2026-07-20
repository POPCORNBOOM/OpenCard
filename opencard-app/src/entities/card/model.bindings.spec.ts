import { describe, expect, it } from 'vitest'
import {
  applyInstance,
  createBlockCustomField,
  createTextBlock,
  deleteBlockCustomField,
  resolveReferences,
  type CardDocument,
  type CardInstanceRecord,
} from './model'

function createDocument(block = createTextBlock({ id: 'text', content: '' })): CardDocument {
  return {
    type: 'card-document',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: 540,
    height: 850,
    background: '#FFFFFF',
    instances: [],
    children: [{
      block,
      location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
    }],
  }
}

describe('card custom fields and bindings', () => {
  it('resolves current-block custom fields into string and number targets', () => {
    const block = createTextBlock({ id: 'text', content: '{{s:label}}' })
    block.customFields = {
      label: { datatype: 'string', title: 'Label', value: 'Power' },
      strength: { datatype: 'number', value: 0.5 },
    }
    ;(block as unknown as Record<string, unknown>).opacity = '{{s:strength}}'

    const result = resolveReferences(createDocument(block))
    const resolved = result.document.children[0]!.block

    expect(result.issues).toEqual([])
    expect(resolved).toMatchObject({ content: 'Power', opacity: 0.5 })
    expect(resolved.customFields).toEqual(block.customFields)
    expect(resolved.customFields).not.toBe(block.customFields)
  })

  it('rejects incompatible and explicitly hidden references', () => {
    const block = createTextBlock({ id: 'text', content: '{{s:type}}' })
    block.customFields = { label: { datatype: 'string', value: 'not-a-number' } }
    ;(block as unknown as Record<string, unknown>).opacity = '{{s:label}}'

    const result = resolveReferences(createDocument(block))

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'FIELD_NOT_ALLOWED',
      'TYPE_MISMATCH',
    ]))
  })

  it('rejects mixed interpolation for non-string targets and detects custom-field cycles', () => {
    const block = createTextBlock({ id: 'text', content: '{{s:first}}' })
    block.customFields = {
      first: { datatype: 'string', value: '{{s:second}}' },
      second: { datatype: 'string', value: '{{s:first}}' },
      strength: { datatype: 'number', value: 0.5 },
    }
    ;(block as unknown as Record<string, unknown>).opacity = '0.{{s:strength}}'

    const result = resolveReferences(createDocument(block))

    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'TYPE_MISMATCH',
      'CYCLE',
    ]))
  })

  it('allows schema-external scalar fields by default', () => {
    const block = createTextBlock({ id: 'text', content: '{{s:externalValue}}' })
    ;(block as unknown as Record<string, unknown>).externalValue = 'External'

    const result = resolveReferences(createDocument(block))

    expect(result.issues).toEqual([])
    expect(result.document.children[0]!.block).toMatchObject({ content: 'External' })
  })

  it('projects custom field overrides without flattening the block model', () => {
    const block = createTextBlock({ id: 'text', content: '{{s:score}}' })
    block.customFields = { score: { datatype: 'number', value: 10 } }
    const document = createDocument(block)
    const instance: CardInstanceRecord = {
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: 1,
      data: { text: { score: 24 } },
    }

    const projected = applyInstance(document, instance)
    const projectedBlock = projected.children[0]!.block

    expect(projectedBlock.customFields?.score?.value).toBe(24)
    expect((projectedBlock as unknown as Record<string, unknown>).score).toBeUndefined()
    expect(resolveReferences(projected).document.children[0]!.block).toMatchObject({ content: '24' })
  })

  it('validates creation and clears instance overrides when deleting', () => {
    const block = createTextBlock({ id: 'text' })
    const document = createDocument(block)
    document.instances = [{
      type: 'card-instance',
      id: 'instance',
      name: 'Instance',
      amount: 1,
      data: { text: { score: 8 } },
    }]

    expect(createBlockCustomField(block, '1bad', 'number')).toBe('invalid')
    expect(createBlockCustomField(block, 'content', 'number')).toBe('duplicate')
    expect(createBlockCustomField(block, 'score', 'number', 'Score')).toBeNull()
    expect(block.customFields?.score).toEqual({ datatype: 'number', title: 'Score', value: 0 })
    expect(deleteBlockCustomField(document, block, 'score')).toBe(1)
    expect(block.customFields).toBeUndefined()
    expect(document.instances[0]!.data.text).toBeUndefined()
  })

  it('keeps existing expressions diagnostic after deleting their custom field', () => {
    const block = createTextBlock({ id: 'text', content: '{{s:score}}' })
    block.customFields = { score: { datatype: 'number', value: 10 } }
    const document = createDocument(block)

    deleteBlockCustomField(document, block, 'score')
    const result = resolveReferences(document)

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'FIELD_NOT_FOUND', token: '{{s:score}}' }),
    ]))
  })
})
