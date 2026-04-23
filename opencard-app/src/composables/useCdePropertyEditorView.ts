import { computed, type Ref } from 'vue'
import type {
  PropertyEditorInput,
  PropertyEditorRecord,
} from '../entities/card/model'
import {
  getTypePropertyEditorSchema,
  type EditorPropertyDefinition,
  type PropertyEditorSchemaOverride,
} from '../entities/card/schema'
import type { CdePropertySortMode } from './useCdePropertyPanelState'

export type CdePropertyEditorEntry = {
  key: string
  label: string
  value: unknown
  definition: EditorPropertyDefinition
}

export type CdeAddableField = {
  key: string
  label: string
  definition: EditorPropertyDefinition
}

export type CdePropertyEditorCategory = {
  sourceKey: string
  key: string
  title: string
  entries: CdePropertyEditorEntry[]
  addableFields: CdeAddableField[]
}

export type CdePropertyEditorSourceView = {
  key: string
  title: string
  categories: CdePropertyEditorCategory[]
}

type UseCdePropertyEditorViewOptions = {
  inputs: Readonly<Ref<PropertyEditorInput[]>>
  sortMode: Readonly<Ref<CdePropertySortMode>>
  translate: (messageKey: string) => string
  hasMessage: (messageKey: string) => boolean
}

const readonlyExtraFieldDefinition: EditorPropertyDefinition = {
  datatype: 'string',
  isReadonly: true,
  categoryId: 'uncategorized',
}

export function useCdePropertyEditorView(options: UseCdePropertyEditorViewOptions) {
  const displaySources = computed<CdePropertyEditorSourceView[]>(() =>
    options.inputs.value
      .map((source) => ({
        key: source.key,
        title: getSourceTitle(source.key, options),
        categories: buildCategories(source, options),
      }))
      .filter((source) => source.categories.length > 0)
  )

  return {
    displaySources,
  }
}

function buildCategories(
  source: PropertyEditorInput,
  options: UseCdePropertyEditorViewOptions,
): CdePropertyEditorCategory[] {
  const definitions = resolveDefinitions(source.record, source.override)
  const visibleDefinitionEntries = Object.entries(definitions)
    .filter(([, definition]) => !definition.isHidden)

  const existingEntries = Object.keys(source.record)
    .map((fieldKey) => {
      const schemaDefinition = definitions[fieldKey]
      if (schemaDefinition?.isHidden) {
        return null
      }

      const resolvedDefinition = schemaDefinition ?? readonlyExtraFieldDefinition
      return createEntry(source.record, fieldKey, resolvedDefinition, options)
    })
    .filter((entry): entry is CdePropertyEditorEntry => entry !== null)

  const addableFields = visibleDefinitionEntries
    .filter(([fieldKey]) => !Object.prototype.hasOwnProperty.call(source.record, fieldKey))
    .map(([fieldKey, definition]) => ({
      key: fieldKey,
      label: getEntryLabel(fieldKey, definition, options),
      definition,
    }))

  if (options.sortMode.value === 'alphabetical') {
    const sortedEntries = sortEntriesByLabel(existingEntries)
    const sortedAddableFields = sortAddableFields(addableFields)
    return sortedEntries.length > 0 || sortedAddableFields.length > 0
      ? [{
        sourceKey: source.key,
        key: 'a-z',
        title: 'A-Z',
        entries: sortedEntries,
        addableFields: sortedAddableFields,
      }]
      : []
  }

  const categoryMap = new Map<string, CdePropertyEditorCategory>()

  for (const entry of existingEntries) {
    const category = ensureCategory(categoryMap, source.key, entry.definition, source.key, options)
    category.entries.push(entry)
  }

  for (const field of addableFields) {
    const category = ensureCategory(categoryMap, source.key, field.definition, source.key, options)
    category.addableFields.push(field)
  }

  return Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      entries: sortEntriesByLabel(category.entries),
      addableFields: sortAddableFields(category.addableFields),
    }))
    .filter((category) => category.entries.length > 0 || category.addableFields.length > 0)
    .sort((left, right) => compareText(left.title, right.title))
}

function ensureCategory(
  categoryMap: Map<string, CdePropertyEditorCategory>,
  sourceKey: string,
  definition: EditorPropertyDefinition,
  sourceFallbackKey: string,
  options: UseCdePropertyEditorViewOptions,
): CdePropertyEditorCategory {
  const categoryId = definition.categoryId
  const categoryKey = categoryId ? `category:${categoryId}` : `fallback:${sourceFallbackKey}`
  const categoryTitle = categoryId
    ? resolveLocalizedText(`propertyEditor.categories.${categoryId}`, categoryId, options)
    : getSourceTitle(sourceFallbackKey, options)

  let category = categoryMap.get(categoryKey)
  if (!category) {
    category = {
      sourceKey,
      key: categoryKey,
      title: categoryTitle,
      entries: [],
      addableFields: [],
    }
    categoryMap.set(categoryKey, category)
  }

  return category
}

function createEntry(
  record: PropertyEditorRecord,
  fieldKey: string,
  definition: EditorPropertyDefinition,
  options: UseCdePropertyEditorViewOptions,
): CdePropertyEditorEntry {
  return {
    key: fieldKey,
    label: getEntryLabel(fieldKey, definition, options),
    value: record[fieldKey],
    definition,
  }
}

function getSourceTitle(sourceKey: string, options: UseCdePropertyEditorViewOptions): string {
  return resolveLocalizedText(`propertyEditor.sources.${sourceKey}`, sourceKey, options)
}

function getEntryLabel(
  fieldKey: string,
  definition: EditorPropertyDefinition,
  options: UseCdePropertyEditorViewOptions,
): string {
  const localizedFieldKey = definition.displayFieldKey ?? fieldKey
  return resolveLocalizedText(`propertyEditor.fields.${localizedFieldKey}`, fieldKey, options)
}

function resolveLocalizedText(
  messageKey: string | undefined,
  fallback: string,
  options: UseCdePropertyEditorViewOptions,
): string {
  if (messageKey && options.hasMessage(messageKey)) {
    return options.translate(messageKey)
  }

  return fallback
}

function resolveDefinitions(
  record: PropertyEditorRecord,
  override?: PropertyEditorSchemaOverride,
): Record<string, EditorPropertyDefinition> {
  const recordType = typeof record.type === 'string' ? record.type : undefined
  const baseDefinitions = getTypePropertyEditorSchema(recordType)
  if (!override) {
    return baseDefinitions
  }

  const mergedDefinitions: Record<string, EditorPropertyDefinition> = { ...baseDefinitions }
  for (const [fieldKey, fieldOverride] of Object.entries(override)) {
    const baseDefinition = mergedDefinitions[fieldKey]
    if (baseDefinition) {
      mergedDefinitions[fieldKey] = {
        ...baseDefinition,
        ...fieldOverride,
      } as EditorPropertyDefinition
      continue
    }

    if (fieldOverride.datatype) {
      mergedDefinitions[fieldKey] = fieldOverride as EditorPropertyDefinition
    }
  }

  return mergedDefinitions
}

function sortEntriesByLabel(entries: CdePropertyEditorEntry[]): CdePropertyEditorEntry[] {
  return [...entries].sort((left, right) => {
    const labelCompare = compareText(left.label, right.label)
    if (labelCompare !== 0) {
      return labelCompare
    }
    return compareText(left.key, right.key)
  })
}

function sortAddableFields(fields: CdeAddableField[]): CdeAddableField[] {
  return [...fields].sort((left, right) => {
    const labelCompare = compareText(left.label, right.label)
    if (labelCompare !== 0) {
      return labelCompare
    }
    return compareText(left.key, right.key)
  })
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' })
}
