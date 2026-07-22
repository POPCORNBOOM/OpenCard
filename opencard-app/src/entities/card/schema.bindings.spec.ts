import { describe, expect, it } from 'vitest'
import {
  acceptsPropertyBinding,
  additionalFieldTypes,
  createPropertyDefaultValue,
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

  it('exposes face background but hides face structure and document faces', () => {
    const faceSchema = getTypePropertyEditorSchema('card-face')
    const documentSchema = getTypePropertyEditorSchema('card-document')

    expect(exposesPropertyReference(faceSchema.background)).toBe(true)
    expect(acceptsPropertyBinding(faceSchema.children)).toBe(false)
    expect(exposesPropertyReference(documentSchema.faces)).toBe(false)
    expect(documentSchema.schemaVersion?.isHidden).toBe(true)
  })

  it('uses the standard fieldType system for every creatable additional field', () => {
    expect(additionalFieldTypes).toEqual([
      'string',
      'filePath',
      'anchorPosition',
      'alignPosition',
      'verticalAlignPosition',
      'flowDirection',
      'number',
      'boolean',
      'color',
    ])
    expect(createPropertyDefaultValue({ fieldType: 'number' })).toBe('0')
    expect(createPropertyDefaultValue({ fieldType: 'boolean' })).toBe('false')
  })
})
