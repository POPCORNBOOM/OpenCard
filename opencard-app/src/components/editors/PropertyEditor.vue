<template>
  <div class="property-editor">
    <div v-if="sources.length === 0" class="empty-hint">选择一个对象查看属性</div>
    <template v-else>
      <section v-for="category in displayCategories" :key="category.title" class="category">
        <div class="category-title">{{ category.title }}</div>
        <div v-for="entry in category.entries" :key="`${category.title}:${entry.key}`" class="prop-row">
          <label class="prop-label">{{ entry.label ?? entry.key }}</label>
          <component
            :is="getEditorComponent(entry.definition.datatype)"
            :definition="entry.definition"
            :value="entry.value"
            @update:value="emit('update-property', { target: entry.target, key: entry.key, value: $event })"
          />
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  type EditorPropertyDefinition,
  type PropertyEditorCategory,
  type PropertyDatatype,
  type PropertyEditorEntry,
  type PropertyEditorSource,
} from '../../core/Card'
import BooleanPropertyField from './property-fields/BooleanPropertyField.vue'
import ColorPropertyField from './property-fields/ColorPropertyField.vue'
import NumberPropertyField from './property-fields/NumberPropertyField.vue'
import ObjectPropertyField from './property-fields/ObjectPropertyField.vue'
import StringPropertyField from './property-fields/StringPropertyField.vue'

const emit = defineEmits<{
  (e: 'update-property', payload: { target: Record<string, unknown>; key: string; value: unknown }): void
}>()

const datatypeEditorMap: Record<PropertyDatatype, Component> = {
  string: StringPropertyField,
  number: NumberPropertyField,
  boolean: BooleanPropertyField,
  color: ColorPropertyField,
  object: ObjectPropertyField,
}

type SortMode = 'category' | 'alphabetical'

const props = defineProps<{
  sources: PropertyEditorSource[]
  sortMode: SortMode
}>()

const defaultDefinition: EditorPropertyDefinition = { datatype: 'string' }

const mergedCategories = computed<PropertyEditorCategory[]>(() =>
  props.sources.map((source) => ({
    title: source.title,
    entries: buildEntries(source),
  }))
)

const visibleCategories = computed(() =>
  mergedCategories.value
    .map((category) => ({
      ...category,
      entries: category.entries
        .filter((entry) => !entry.definition.isHiddenForEditor)
        .map((entry) => ({
          ...entry,
          label: entry.label ?? entry.definition.label ?? entry.key,
          category: entry.category ?? entry.definition.category,
          sourceCategoryTitle: entry.sourceCategoryTitle ?? category.title,
        })),
    }))
    .filter((category) => category.entries.length > 0)
)

const displayCategories = computed<PropertyEditorCategory[]>(() => {
  const flatEntries = visibleCategories.value.flatMap((category) => category.entries)
  if (props.sortMode === 'alphabetical') {
    return buildAlphabeticalCategories(flatEntries)
  }
  return buildDefinitionCategories(flatEntries)
})

function getEditorComponent(datatype: PropertyDatatype): Component {
  return datatypeEditorMap[datatype] ?? StringPropertyField
}

function buildDefinitionCategories(entries: PropertyEditorEntry[]): PropertyEditorCategory[] {
  const bucket = new Map<string, PropertyEditorEntry[]>()

  for (const entry of sortEntriesByKey(entries)) {
    const title = entry.category ?? entry.sourceCategoryTitle ?? 'General'
    if (!bucket.has(title)) {
      bucket.set(title, [])
    }
    bucket.get(title)?.push(entry)
  }

  return Array.from(bucket.entries())
    .sort(([left], [right]) => compareText(left, right))
    .map(([title, groupedEntries]) => ({
      title,
      entries: groupedEntries,
    }))
}

function buildAlphabeticalCategories(entries: PropertyEditorEntry[]): PropertyEditorCategory[] {
  return [
    {
      title: 'AZ',
      entries: sortEntriesByKey(entries),
    },
  ]
}

function sortEntriesByKey(entries: PropertyEditorEntry[]): PropertyEditorEntry[] {
  return [...entries].sort((left, right) => {
    const keyCompare = compareText(left.key, right.key)
    if (keyCompare !== 0) {
      return keyCompare
    }
    return compareText(getEntryLabel(left), getEntryLabel(right))
  })
}

function getEntryLabel(entry: PropertyEditorEntry): string {
  return entry.label ?? entry.definition.label ?? entry.key
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' })
}

function buildEntries(source: PropertyEditorSource): PropertyEditorEntry[] {
  const definitions = resolveDefinitions(source)
  const keys = new Set<string>([
    ...Object.keys(source.target),
    ...Object.keys(definitions),
  ])

  return Array.from(keys).map((key) => {
    const definition = definitions[key] ?? defaultDefinition
    return {
      key,
      label: definition.label,
      category: definition.category,
      sourceCategoryTitle: source.title,
      value: source.target[key],
      target: source.target,
      definition,
    }
  })
}

function resolveDefinitions(source: PropertyEditorSource): Record<string, EditorPropertyDefinition> {
  const explicitDefinitions = source.definitions ?? {}
  const targetType = typeof source.target.type === 'string' ? source.target.type : undefined
  const inferredDefinitions = targetType ? source.typeDefinitions?.[targetType] ?? {} : {}

  return {
    ...inferredDefinitions,
    ...explicitDefinitions,
  }
}
</script>

<style scoped>
.property-editor {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-hint {
  color: #666;
  font-size: 12px;
  text-align: center;
  padding: 20px;
}

.category {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category + .category {
  margin-top: 12px;
}

.category-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #888;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.prop-label {
  font-size: 11px;
  color: #9cdcfe;
  min-width: 80px;
  flex-shrink: 0;
}
</style>
