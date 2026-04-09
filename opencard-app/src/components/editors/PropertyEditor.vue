<template>
  <div class="property-editor">
    <div v-if="sources.length === 0" class="empty-hint">选择一个对象查看属性</div>
    <template v-else>
      <section v-for="source in displaySources" :key="source.title" class="source-section">
        <div class="source-title">{{ source.title }}</div>
        <section v-for="category in source.categories" :key="`${source.title}:${category.title}`" class="category">
          <div class="category-header">
            <div class="category-title">{{ category.title }}</div>
            <div v-if="category.addableFields.length > 0" class="add-field-menu">
              <span class="add-field-count">{{ category.addableFields.length }}</span>
              <button class="add-field-button" type="button" title="添加字段"
                @click="openAddFieldMenu($event, category)">
                <span class="codicon codicon-add" />
              </button>
            </div>
          </div>
          <div v-for="entry in category.entries" :key="`${source.title}:${category.title}:${entry.key}`"
            class="prop-row">
            <label class="prop-label">{{ entry.label }}</label>
            <component :is="getEditorComponent(entry.definition.datatype)" :definition="entry.definition"
              :value="entry.value"
              @update:value="emit('update-property', { sourceTitle: category.sourceTitle, target: entry.target, key: entry.key, value: $event })" />
          </div>
        </section>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  type PropertyEditorSource,
  type PropertyEditorTarget,
} from '../../core/Card'
import {
  getTypePropertyEditorSchema,
  type EditorPropertyDefinition,
  type PropertyDatatype,
} from '../../core/propertyEditorSchema'
import AlignPositionPropertyField from './property-fields/AlignPositionPropertyField.vue'
import BooleanPropertyField from './property-fields/BooleanPropertyField.vue'
import AnchorPositionPropertyField from './property-fields/AnchorPositionPropertyField.vue'
import ColorPropertyField from './property-fields/ColorPropertyField.vue'
import FilePathPropertyField from './property-fields/FilePathPropertyField.vue'
import FlowDirectionPropertyField from './property-fields/FlowDirectionPropertyField.vue'
import NumberPropertyField from './property-fields/NumberPropertyField.vue'
import ObjectPropertyField from './property-fields/ObjectPropertyField.vue'
import StringPropertyField from './property-fields/StringPropertyField.vue'
import { useFloatingMenu, type FloatingMenuItem } from '../../composables/useFloatingMenu'

const emit = defineEmits<{
  (e: 'update-property', payload: { sourceTitle: string; target: Record<string, unknown>; key: string; value: unknown }): void
  (e: 'add-property', payload: { sourceTitle: string; target: Record<string, unknown>; key: string; value: unknown }): void
}>()

const datatypeEditorMap: Record<PropertyDatatype, Component> = {
  string: StringPropertyField,
  anchorPosition: AnchorPositionPropertyField,
  alignPosition: AlignPositionPropertyField,
  flowDirection: FlowDirectionPropertyField,
  number: NumberPropertyField,
  boolean: BooleanPropertyField,
  color: ColorPropertyField,
  filePath: FilePathPropertyField,
  object: ObjectPropertyField,
}

type SortMode = 'category' | 'alphabetical'

type PropertyEditorEntry = {
  key: string
  label: string
  value: unknown
  target: PropertyEditorTarget
  definition: EditorPropertyDefinition
}

type AddableField = {
  key: string
  label: string
  definition: EditorPropertyDefinition
}

type PropertyEditorCategory = {
  sourceTitle: string
  title: string
  target: PropertyEditorTarget
  entries: PropertyEditorEntry[]
  addableFields: AddableField[]
}

type PropertyEditorSourceView = {
  title: string
  categories: PropertyEditorCategory[]
}

const props = defineProps<{
  sources: PropertyEditorSource[]
  sortMode: SortMode
}>()

const defaultDefinition: EditorPropertyDefinition = { datatype: 'string' }
const { openMenu } = useFloatingMenu()

const displaySources = computed<PropertyEditorSourceView[]>(() =>
  props.sources
    .map((source) => ({
      title: source.title,
      categories: buildCategories(source),
    }))
    .filter((source) => source.categories.length > 0)
)

function getEditorComponent(datatype: PropertyDatatype): Component {
  return datatypeEditorMap[datatype] ?? StringPropertyField
}

function buildCategories(source: PropertyEditorSource): PropertyEditorCategory[] {
  const definitions = resolveDefinitions(source.target)
  const targetKeys = new Set(Object.keys(source.target))
  const visibleDefinitionEntries = Object.entries(definitions).filter(([, definition]) => !definition.isHidden)

  if (props.sortMode === 'alphabetical') {
    const keys = new Set<string>([
      ...targetKeys,
      ...visibleDefinitionEntries.map(([key]) => key),
    ])

    const entries = sortEntriesByLabel(
      Array.from(keys).map((key) => createEntry(source.target, key, definitions[key]))
    )

    const addableFields: AddableField[] = []

    return entries.length > 0 || addableFields.length > 0
      ? [{
        sourceTitle: source.title,
        title: 'A-Z',
        target: source.target,
        entries,
        addableFields,
      }]
      : []
  }

  const categoryMap = new Map<string, PropertyEditorCategory>()
  const visibleKeys = new Set<string>()

  for (const key of Object.keys(source.target)) {
    const definition = definitions[key]
    if (definition?.isHidden) {
      continue
    }
    const entry = createEntry(source.target, key, definition)
    const title = getCategoryTitle(source.title, entry.definition)
    visibleKeys.add(key)
    ensureCategory(categoryMap, source, title).entries.push(entry)
  }

  for (const [key, definition] of visibleDefinitionEntries) {
    const title = getCategoryTitle(source.title, definition)
    const category = ensureCategory(categoryMap, source, title)

    if (!visibleKeys.has(key)) {
      category.addableFields.push({
        key,
        label: getEntryLabel(key, definition),
        definition,
      })
    }
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
  categoryMap: Map<string, PropertyEditorCategory>,
  source: PropertyEditorSource,
  title: string
): PropertyEditorCategory {
  let category = categoryMap.get(title)
  if (!category) {
    category = {
      sourceTitle: source.title,
      title,
      target: source.target,
      entries: [],
      addableFields: [],
    }
    categoryMap.set(title, category)
  }
  return category
}

function createEntry(
  target: PropertyEditorTarget,
  key: string,
  definition?: EditorPropertyDefinition
): PropertyEditorEntry {
  const resolvedDefinition = definition ?? defaultDefinition
  return {
    key,
    label: getEntryLabel(key, resolvedDefinition),
    value: target[key],
    target,
    definition: resolvedDefinition,
  }
}

function getEntryLabel(key: string, definition: EditorPropertyDefinition): string {
  return definition.label ?? key
}

function getCategoryTitle(sourceTitle: string, definition: EditorPropertyDefinition): string {
  return definition.category ?? sourceTitle
}

function resolveDefinitions(target: PropertyEditorTarget): Record<string, EditorPropertyDefinition> {
  const targetType = typeof target.type === 'string' ? target.type : undefined
  return getTypePropertyEditorSchema(targetType)
}

function sortEntriesByLabel(entries: PropertyEditorEntry[]): PropertyEditorEntry[] {
  return [...entries].sort((left, right) => {
    const labelCompare = compareText(left.label, right.label)
    if (labelCompare !== 0) {
      return labelCompare
    }
    return compareText(left.key, right.key)
  })
}

function sortAddableFields(fields: AddableField[]): AddableField[] {
  return [...fields].sort((left, right) => compareText(left.label, right.label))
}

function compareText(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' })
}

function openAddFieldMenu(event: MouseEvent, category: PropertyEditorCategory): void {
  const anchor = event.currentTarget
  if (!(anchor instanceof HTMLElement)) {
    return
  }

  const items: FloatingMenuItem[] = category.addableFields.map((field) => ({
    key: field.key,
    label: field.label,
  }))

  openMenu({
    anchor,
    items,
    placement: 'bottom-end',
    onSelect: (fieldKey) => {
      const field = category.addableFields.find((candidate) => candidate.key === fieldKey)
      if (!field) {
        return
      }

      addField(category, field)
    },
  })
}

function addField(category: PropertyEditorCategory, field: AddableField): void {
  const value = createDefaultValue(field.definition)
  emit('add-property', {
    sourceTitle: category.sourceTitle,
    target: category.target,
    key: field.key,
    value,
  })
}

function createDefaultValue(definition: EditorPropertyDefinition): unknown {
  switch (definition.datatype) {
    case 'string':
      return definition.options?.[0] ?? ''
    case 'filePath':
    case 'color':
      return ''
    case 'anchorPosition':
      return 'cc'
    case 'alignPosition':
      return 'start'
    case 'flowDirection':
      return 'lr'
    case 'number':
      return definition.min ?? 0
    case 'boolean':
      return false
    case 'object':
      return definition.isArray ? [] : {}
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

.source-section+.source-section {
  margin-top: 16px;
}

.source-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #d7ba7d;
  padding-bottom: 6px;
  margin-bottom: 8px;
  border-bottom: 1px solid #333;
}

.category {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.category+.category {
  margin-top: 12px;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #333;
}

.category-title {
  font-size: 11px;
  text-transform: uppercase;
  color: #888;
}

.add-field-menu {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  position: relative;
}

.add-field-count {
  min-width: 10px;
  font-size: 11px;
  color: #888;
  text-align: right;
}

.add-field-button {
  width: 18px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #3f3f46;
  background: #252526;
  color: #c5c5c5;
  cursor: pointer;
  padding: 0;
}

.add-field-button:hover {
  background: #2a2d2e;
  border-color: #0e639c;
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
