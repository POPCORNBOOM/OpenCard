import { computed, type Ref } from 'vue'
import {
  createPropertyEditorInput,
  type PropertyEditorAddableItem,
  type PropertyEditorCategoryDefinition,
  type PropertyEditorFieldDefinition,
  type PropertyEditorInput,
  type PropertyEditorItem,
  type PropertyEditorSortMode,
} from './propertyEditor.types'
import type { IconToken } from '../icon/iconRegistry'

export type PropertyEditorEntry = {
  key: string
  fieldKey: string
  label: string
  value: unknown
  definition: PropertyEditorFieldDefinition
  readonly?: boolean
  action?: PropertyEditorItem['action']
  tail?: PropertyEditorItem['tail']
}

export type PropertyEditorAddableField = {
  key: string
  label: string
  definition: PropertyEditorFieldDefinition
}

export type PropertyEditorCategoryView = {
  inputKey: string
  key: string
  title: string
  icon: IconToken
  entries: PropertyEditorEntry[]
  addableFields: PropertyEditorAddableField[]
}

export type PropertyEditorSourceView = {
  key: string
  title: string
  categories: PropertyEditorCategoryView[]
}

type UsePropertyEditorViewOptions = {
  inputs: Readonly<Ref<readonly PropertyEditorInput[]>>
  categories: Readonly<Ref<ReadonlyMap<string, PropertyEditorCategoryDefinition>>>
  sortMode: Readonly<Ref<PropertyEditorSortMode>>
  otherCategory: Readonly<Ref<PropertyEditorCategoryDefinition>>
}

const OTHER_CATEGORY_KEY = 'category:__other__'

export function usePropertyEditorView(options: UsePropertyEditorViewOptions) {
  const displaySources = computed<PropertyEditorSourceView[]>(() =>
    options.inputs.value
      .map((source) => ({
        key: source.key,
        title: source.title?.trim() || source.key,
        categories: buildCategories(source, options),
      }))
      .filter((source) => source.categories.length > 0),
  )

  return { displaySources }
}

function buildCategories(
  source: PropertyEditorInput,
  options: UsePropertyEditorViewOptions,
): PropertyEditorCategoryView[] {
  const normalized = source.items
    ? source
    : createPropertyEditorInput({
      key: source.key,
      title: source.title,
      record: source.record ?? {},
      fields: source.fields ?? {},
    })
  const existingEntries = (normalized.items ?? []).map(createEntry)
  const addableFields = (normalized.addableItems ?? []).map(createAddableField)

  if (options.sortMode.value === 'alphabetical') {
    const entries = sortByLabel(existingEntries)
    const missing = sortByLabel(addableFields)
    if (entries.length === 0 && missing.length === 0) return []
    return [{
      inputKey: source.key,
      key: 'a-z',
      title: 'A-Z',
      icon: 'data.list-selection',
      entries,
      addableFields: missing,
    }]
  }

  const categoryMap = new Map<string, PropertyEditorCategoryView>()
  for (const entry of existingEntries) {
    ensureCategory(categoryMap, source.key, entry.definition, options).entries.push(entry)
  }
  for (const field of addableFields) {
    ensureCategory(categoryMap, source.key, field.definition, options).addableFields.push(field)
  }

  const orderedKeys = new Map(
    Array.from(options.categories.value.keys()).map((key, index) => [key, index]),
  )
  return Array.from(categoryMap.values())
    .map((category) => ({
      ...category,
      entries: sortByDefaultOrder(category.entries),
      addableFields: sortByDefaultOrder(category.addableFields),
    }))
    .sort((left, right) => {
      if (left.key === OTHER_CATEGORY_KEY) return 1
      if (right.key === OTHER_CATEGORY_KEY) return -1
      return (orderedKeys.get(left.key) ?? Number.MAX_SAFE_INTEGER)
        - (orderedKeys.get(right.key) ?? Number.MAX_SAFE_INTEGER)
    })
}

function createEntry(item: PropertyEditorItem): PropertyEditorEntry {
  return {
    key: item.key,
    fieldKey: item.fieldKey,
    label: item.title,
    value: item.value,
    definition: item.definition,
    readonly: item.readonly,
    action: item.action,
    tail: item.tail,
  }
}

function createAddableField(item: PropertyEditorAddableItem): PropertyEditorAddableField {
  return { key: item.fieldKey, label: item.title, definition: item.definition }
}

function ensureCategory(
  target: Map<string, PropertyEditorCategoryView>,
  inputKey: string,
  field: PropertyEditorFieldDefinition,
  options: UsePropertyEditorViewOptions,
): PropertyEditorCategoryView {
  const requestedKey = field.category
  const categoryDefinition = requestedKey
    ? options.categories.value.get(requestedKey)
    : undefined
  const key = categoryDefinition && requestedKey ? requestedKey : OTHER_CATEGORY_KEY
  const definition = categoryDefinition ?? options.otherCategory.value

  let category = target.get(key)
  if (!category) {
    category = {
      inputKey,
      key,
      title: definition.title,
      icon: definition.icon ?? 'data.list-tree',
      entries: [],
      addableFields: [],
    }
    target.set(key, category)
  }
  return category
}

function sortByDefaultOrder<T extends { key: string, label: string, definition: PropertyEditorFieldDefinition }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) => {
    const leftOrder = left.definition.order ?? Number.MAX_SAFE_INTEGER
    const rightOrder = right.definition.order ?? Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder || compareByLabel(left, right)
  })
}

function sortByLabel<T extends { key: string, label: string }>(items: readonly T[]): T[] {
  return [...items].sort(compareByLabel)
}

function compareByLabel<T extends { key: string, label: string }>(left: T, right: T): number {
  return left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
}
