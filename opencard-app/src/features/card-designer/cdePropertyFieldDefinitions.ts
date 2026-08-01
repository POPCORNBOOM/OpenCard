import type {
  PropertyEditorFieldDefinition,
  PropertyEditorInput,
} from '../../shared/ui/property-editor/propertyEditor.types'
import {
  createPropertyDefaultValue,
  getTypePropertyEditorSchema,
  type EditorPropertyDefinition,
} from '../../entities/card/schema'
import type { BindingScopeKind } from '../editor-runtime/model/bindingExpression'

export type CdePropertyFieldDefinition = PropertyEditorFieldDefinition & {
  acceptsBinding?: false
  bindingScopes?: readonly BindingScopeKind[]
}

export type CdePropertyEditorInput = Omit<PropertyEditorInput, 'fields'> & {
  fields: Readonly<Record<string, CdePropertyFieldDefinition>>
}

export type CdePropertyFieldDefinitionOptions = {
  allowDelete: boolean
  translate: (messageKey: string) => string
  hasMessage: (messageKey: string) => boolean
  override?: Readonly<Record<string, Partial<EditorPropertyDefinition>>>
  labels?: Readonly<Record<string, string>>
  customKeys?: ReadonlySet<string>
}

export function resolveCdePropertyFields(
  record: Readonly<Record<string, unknown>>,
  options: CdePropertyFieldDefinitionOptions,
): Record<string, CdePropertyFieldDefinition> {
  const typeName = typeof record.type === 'string' ? record.type : undefined
  const definitions: Record<string, EditorPropertyDefinition> = { ...getTypePropertyEditorSchema(typeName) }
  for (const [fieldKey, fieldOverride] of Object.entries(options.override ?? {})) {
    const base = definitions[fieldKey]
    if (base) definitions[fieldKey] = { ...base, ...fieldOverride } as EditorPropertyDefinition
    else if (fieldOverride.fieldType) definitions[fieldKey] = fieldOverride as EditorPropertyDefinition
  }
  for (const fieldKey of Object.keys(record)) {
    if (!definitions[fieldKey]) definitions[fieldKey] = { fieldType: 'string', isReadonly: true }
  }

  return Object.fromEntries(Object.entries(definitions).map(([fieldKey, definition], order) => {
    const displayKey = definition.displayFieldKey ?? fieldKey
    const messageKey = `propertyEditor.fields.${displayKey}`
    const title = options.labels?.[fieldKey]
      ?? (options.hasMessage(messageKey) ? options.translate(messageKey) : fieldKey)
    return [fieldKey, {
      ...definition,
      defaultValue: createPropertyDefaultValue(definition),
      title,
      category: options.customKeys?.has(fieldKey) ? 'custom' : definition.categoryId,
      order,
      deletable: options.allowDelete
        && definition.isReadonly !== true
        && (definition.deletable === true || definition.required !== true),
      ...(definition.fieldType === 'string' && definition.autocomplete?.length
        ? {
            completion: {
              static: {
                values: definition.autocomplete,
                presentation: 'ghost' as const,
              },
            },
          }
        : {}),
    }]
  }))
}
