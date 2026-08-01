import { describe, expect, it } from 'vitest'
import {
  acceptsPropertyBinding,
  additionalFieldTypes,
  createPropertyDefaultValue,
  exposesPropertyReference,
  getPropertyValueKind,
  getTypePropertyEditorSchema,
  isReferenceFieldExposed,
  propertyEditorCategoryDefinitions,
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

  it('keeps optional document metadata addable in one category', () => {
    const schema = getTypePropertyEditorSchema('card-document')

    expect(schema.name).toMatchObject({ fieldType: 'string', categoryId: 'identity' })
    expect(schema.description).toMatchObject({
      fieldType: 'string',
      categoryId: 'identity',
      multiline: true,
    })
    expect(schema.notes).toMatchObject({
      fieldType: 'string',
      categoryId: 'identity',
      multiline: true,
    })
    expect(schema.name?.deletable).toBeUndefined()
    expect(schema.description?.deletable).toBeUndefined()
    expect(schema.notes?.deletable).toBeUndefined()
    for (const fieldKey of ['name', 'description', 'notes', 'version', 'width', 'height']) {
      expect(schema[fieldKey]?.bindingScopes).toEqual(['project'])
    }
    expect(schema.name?.defaultValue).toBeUndefined()
    expect(schema.description?.defaultValue).toBeUndefined()
    expect(schema.notes?.defaultValue).toBeUndefined()
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

  it('defines notes and visibility for every block type', () => {
    const blockTypes = [
      'text-block',
      'markdown-text-block',
      'image-block',
      'qrcode-block',
      'shape-block',
      'simple-container-block',
      'flow-container-block',
    ]

    for (const blockType of blockTypes) {
      const schema = getTypePropertyEditorSchema(blockType)
      expect(schema.notes).toMatchObject({ fieldType: 'string', multiline: true, defaultValue: '' })
      expect(schema.visible).toMatchObject({ fieldType: 'boolean', defaultValue: 'true' })
    }
  })

  it('groups disputed visual fields by their user-facing editing task', () => {
    const textSchema = getTypePropertyEditorSchema('text-block')
    const shapeSchema = getTypePropertyEditorSchema('shape-block')

    expect(textSchema.color?.categoryId).toBe('typography')
    expect(textSchema.customCss?.categoryId).toBe('custom')
    expect(shapeSchema.shape?.categoryId).toBe('appearance')
  })

  it('assigns every visible native field to a registered category', () => {
    const typeNames = [
      'text-block',
      'markdown-text-block',
      'image-block',
      'qrcode-block',
      'shape-block',
      'simple-container-block',
      'flow-container-block',
      'simple-container-location',
      'flow-container-location',
      'card-document',
      'card-face',
      'card-instance',
    ]

    for (const typeName of typeNames) {
      for (const [fieldKey, definition] of Object.entries(getTypePropertyEditorSchema(typeName))) {
        if (definition.isHidden) continue
        expect(
          definition.categoryId,
          `${typeName}.${fieldKey} should have a registered category`,
        ).toBeDefined()
        if (definition.categoryId) {
          expect(propertyEditorCategoryDefinitions).toHaveProperty(definition.categoryId)
        }
      }
    }
  })

  it('marks text content with explicit rich-text editing capability', () => {
    expect(getTypePropertyEditorSchema('text-block').content).toMatchObject({
      fieldType: 'string',
      multiline: true,
      richText: true,
    })
    expect(getTypePropertyEditorSchema('markdown-text-block').content).toMatchObject({
      fieldType: 'string',
      multiline: true,
    })
    expect(getTypePropertyEditorSchema('markdown-text-block').content?.richText).toBeUndefined()
  })
})
