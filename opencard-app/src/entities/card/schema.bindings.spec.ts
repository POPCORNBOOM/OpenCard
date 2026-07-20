import { describe, expect, it } from 'vitest'
import {
  acceptsPropertyBinding,
  createCustomFieldDefaultValue,
  exposesPropertyReference,
  getPropertyValueKind,
  getTypePropertyEditorSchema,
  isReferenceFieldExposed,
} from './schema'

describe('property binding schema policy', () => {
  it('allows scalar fields by default and requires explicit blacklisting', () => {
    const schema = getTypePropertyEditorSchema('text-block')

    expect(acceptsPropertyBinding(schema.content)).toBe(true)
    expect(exposesPropertyReference(schema.content)).toBe(true)
    expect(acceptsPropertyBinding(schema.type)).toBe(false)
    expect(exposesPropertyReference(schema.type)).toBe(false)
    expect(acceptsPropertyBinding(undefined)).toBe(true)
    expect(exposesPropertyReference(undefined)).toBe(true)
  })

  it('never exposes object fields and derives primitive value kinds', () => {
    const containerSchema = getTypePropertyEditorSchema('simple-container-block')
    const textSchema = getTypePropertyEditorSchema('text-block')

    expect(acceptsPropertyBinding(containerSchema.children)).toBe(false)
    expect(isReferenceFieldExposed('simple-container-block', 'children')).toBe(false)
    expect(getPropertyValueKind(textSchema.opacity)).toBe('number')
    expect(getPropertyValueKind(textSchema.content)).toBe('string')
  })

  it('creates defaults for every supported custom scalar editor', () => {
    expect({
      string: createCustomFieldDefaultValue('string'),
      filePath: createCustomFieldDefaultValue('filePath'),
      anchorPosition: createCustomFieldDefaultValue('anchorPosition'),
      alignPosition: createCustomFieldDefaultValue('alignPosition'),
      verticalAlignPosition: createCustomFieldDefaultValue('verticalAlignPosition'),
      flowDirection: createCustomFieldDefaultValue('flowDirection'),
      number: createCustomFieldDefaultValue('number'),
      boolean: createCustomFieldDefaultValue('boolean'),
      color: createCustomFieldDefaultValue('color'),
    }).toEqual({
      string: '',
      filePath: '',
      anchorPosition: 'cc',
      alignPosition: 'start',
      verticalAlignPosition: 'top',
      flowDirection: 'lr',
      number: 0,
      boolean: false,
      color: '',
    })
  })
})
