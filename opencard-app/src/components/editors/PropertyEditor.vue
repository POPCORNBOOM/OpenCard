<!--
  使用说明：
  - 作为通用字段编辑器使用，输入 `inputs` 与 `sortMode`。
  - 字段更新/添加/重置都通过事件上抛，不直接改写传入 record。

  职责边界：
  - 负责 schema 解析、分类展示（含本地化）、field 编辑器分派与“+ 添加字段”交互。
  - 只上抛编辑意图，不承载业务写回策略。

  主要输出事件：
  - `update-property`（字段更新意图）
  - `add-property`（字段新增意图）
  - `reset-property`（字段重置意图）
-->
<template>
  <div class="property-editor">
    <div v-if="inputs.length === 0" class="empty-hint">选择一个对象查看属性</div>
    <template v-else>
      <section v-for="source in displaySources" :key="source.key" class="source-section">
        <div class="source-title">{{ source.title }}</div>
        <section v-for="category in source.categories" :key="`${source.key}:${category.key}`" class="category">
          <div class="category-header">
            <div class="category-title">{{ category.title }}</div>
            <div v-if="category.addableFields.length > 0" class="add-field-menu">
              <span class="add-field-count">{{ category.addableFields.length }}</span>
              <OcButton
                class="add-field-button"
                icon-only
                size="sm"
                variant="secondary"
                :title="addFieldActionText"
                :aria-label="addFieldActionText"
                @click="openAddFieldMenu($event, category)"
              >
                <span class="codicon codicon-add" />
              </OcButton>
            </div>
          </div>
          <OcPropertyRow
            v-for="entry in category.entries"
            :key="`${source.key}:${category.key}:${entry.key}`"
            :label="entry.label"
            :label-icon="getEditorIconClass(entry.definition.datatype)"
          >
            <div class="entry-control">
              <OcButton
                v-if="entry.definition.resettable"
                class="reset-field-button"
                icon-only
                size="sm"
                variant="secondary"
                :title="resetFieldActionText"
                :aria-label="`${resetFieldActionText}: ${entry.label}`"
                @click.stop="emitResetProperty(category.sourceKey, entry.key)"
              >
                <span class="codicon codicon-discard" />
              </OcButton>
              <component
                :is="getEditorComponent(entry.definition.datatype)"
                :definition="entry.definition"
                :value="entry.value"
                @update:value="emit('update-property', { sourceKey: category.sourceKey, fieldKey: entry.key, value: $event })"
              />
            </div>
          </OcPropertyRow>
        </section>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
// Vue 基础能力与依赖组件。
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type PropertyEditorInput,
  type PropertyEditorRecord,
} from '../../entities/card/model'
import {
  getTypePropertyEditorSchema,
  type EditorPropertyDefinition,
  type PropertyDatatype,
  type PropertyEditorSchemaOverride,
} from '../../entities/card/schema'
import AlignPositionPropertyField from './property-fields/AlignPositionPropertyField.vue'
import BackgroundPropertyField from './property-fields/BackgroundPropertyField.vue'
import BooleanPropertyField from './property-fields/BooleanPropertyField.vue'
import AnchorPositionPropertyField from './property-fields/AnchorPositionPropertyField.vue'
import ColorPropertyField from './property-fields/ColorPropertyField.vue'
import FilePathPropertyField from './property-fields/FilePathPropertyField.vue'
import FlowDirectionPropertyField from './property-fields/FlowDirectionPropertyField.vue'
import NumberPropertyField from './property-fields/NumberPropertyField.vue'
import ObjectPropertyField from './property-fields/ObjectPropertyField.vue'
import StringPropertyField from './property-fields/StringPropertyField.vue'
import { useFloatingMenu, type FloatingMenuItem } from '../../composables/useFloatingMenu'
import OcButton from '../base/OcButton.vue'
import OcPropertyRow from '../base/OcPropertyRow.vue'

// 输出事件协议。
type PropertyEditorMutation = {
  sourceKey: string
  fieldKey: string
  value: unknown
}

type PropertyEditorResetMutation = {
  sourceKey: string
  fieldKey: string
}

const emit = defineEmits<{
  (e: 'update-property', payload: PropertyEditorMutation): void
  (e: 'add-property', payload: PropertyEditorMutation): void
  (e: 'reset-property', payload: PropertyEditorResetMutation): void
}>()

// 视图模型。
type SortMode = 'category' | 'alphabetical'

type PropertyEditorEntry = {
  key: string
  label: string
  value: unknown
  definition: EditorPropertyDefinition
}

type AddableField = {
  key: string
  label: string
  definition: EditorPropertyDefinition
}

type PropertyEditorCategory = {
  sourceKey: string
  key: string
  title: string
  entries: PropertyEditorEntry[]
  addableFields: AddableField[]
}

type PropertyEditorSourceView = {
  key: string
  title: string
  categories: PropertyEditorCategory[]
}

// 组件输入协议。
const props = defineProps<{
  inputs: PropertyEditorInput[]
  sortMode: SortMode
}>()

// 运行时依赖与编辑器映射。
type DatatypeEditorEntry = {
  component: Component
  icon: string
}

const datatypeEditorMap: Record<PropertyDatatype, DatatypeEditorEntry> = {
  string: { component: StringPropertyField, icon: 'codicon-symbol-string' },
  background: { component: BackgroundPropertyField, icon: 'codicon-symbol-color' },
  anchorPosition: { component: AnchorPositionPropertyField, icon: 'codicon-compass' },
  alignPosition: { component: AlignPositionPropertyField, icon: 'codicon-list-selection' },
  flowDirection: { component: FlowDirectionPropertyField, icon: 'codicon-arrow-right' },
  number: { component: NumberPropertyField, icon: 'codicon-symbol-number' },
  boolean: { component: BooleanPropertyField, icon: 'codicon-symbol-boolean' },
  color: { component: ColorPropertyField, icon: 'codicon-symbol-color' },
  filePath: { component: FilePathPropertyField, icon: 'codicon-file' },
  object: { component: ObjectPropertyField, icon: 'codicon-symbol-class' },
}

const readonlyExtraFieldDefinition: EditorPropertyDefinition = {
  datatype: 'string',
  isReadonly: true,
  categoryId: 'uncategorized',
}

const { openMenu } = useFloatingMenu()
const { t, te } = useI18n()

const addFieldActionText = computed(() =>
  resolveLocalizedText('propertyEditor.actions.addField', 'Add Field')
)
const resetFieldActionText = computed(() =>
  resolveLocalizedText('propertyEditor.actions.reset', 'Reset')
)

// 属性面板展示源派生。
const displaySources = computed<PropertyEditorSourceView[]>(() =>
  props.inputs
    .map((source) => ({
      key: source.key,
      title: getSourceTitle(source.key),
      categories: buildCategories(source),
    }))
    .filter((source) => source.categories.length > 0)
)

function getEditorComponent(datatype: PropertyDatatype): Component {
  return (datatypeEditorMap[datatype] ?? datatypeEditorMap.string).component
}

function getEditorIconClass(datatype: PropertyDatatype): string {
  return (datatypeEditorMap[datatype] ?? datatypeEditorMap.string).icon
}

// 分类与字段构建逻辑。
function buildCategories(source: PropertyEditorInput): PropertyEditorCategory[] {
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
      return createEntry(source.record, fieldKey, resolvedDefinition)
    })
    .filter((entry): entry is PropertyEditorEntry => entry !== null)

  const addableFields = visibleDefinitionEntries
    .filter(([fieldKey]) => !Object.prototype.hasOwnProperty.call(source.record, fieldKey))
    .map(([fieldKey, definition]) => ({
      key: fieldKey,
      label: getEntryLabel(fieldKey, definition),
      definition,
    }))

  if (props.sortMode === 'alphabetical') {
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

  const categoryMap = new Map<string, PropertyEditorCategory>()

  for (const entry of existingEntries) {
    const category = ensureCategory(categoryMap, source.key, entry.definition, source.key)
    category.entries.push(entry)
  }

  for (const field of addableFields) {
    const category = ensureCategory(categoryMap, source.key, field.definition, source.key)
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
  categoryMap: Map<string, PropertyEditorCategory>,
  sourceKey: string,
  definition: EditorPropertyDefinition,
  sourceFallbackKey: string,
): PropertyEditorCategory {
  const categoryId = definition.categoryId
  const categoryKey = categoryId ? `category:${categoryId}` : `fallback:${sourceFallbackKey}`
  const categoryTitle = categoryId
    ? resolveLocalizedText(`propertyEditor.categories.${categoryId}`, categoryId)
    : getSourceTitle(sourceFallbackKey)

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
): PropertyEditorEntry {
  return {
    key: fieldKey,
    label: getEntryLabel(fieldKey, definition),
    value: record[fieldKey],
    definition,
  }
}

// 文案解析与 schema 合并。
function getSourceTitle(sourceKey: string): string {
  return resolveLocalizedText(`propertyEditor.sources.${sourceKey}`, sourceKey)
}

function getEntryLabel(fieldKey: string, definition: EditorPropertyDefinition): string {
  const localizedFieldKey = definition.displayFieldKey ?? fieldKey
  return resolveLocalizedText(`propertyEditor.fields.${localizedFieldKey}`, fieldKey)
}

function resolveLocalizedText(messageKey: string | undefined, fallback: string): string {
  if (messageKey && te(messageKey)) {
    return t(messageKey)
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

// 排序工具。
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

// 添加字段与重置交互。
function openAddFieldMenu(event: MouseEvent, category: PropertyEditorCategory): void {
  const anchor = event.currentTarget
  if (!(anchor instanceof HTMLElement)) {
    return
  }

  const items: FloatingMenuItem[] = category.addableFields.map((field) => ({
    key: field.key,
    label: field.label,
    icon: getEditorIconClass(field.definition.datatype),
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

      emit('add-property', {
        sourceKey: category.sourceKey,
        fieldKey: field.key,
        value: createDefaultValue(field.definition),
      })
    },
  })
}

function emitResetProperty(sourceKey: string, fieldKey: string): void {
  emit('reset-property', { sourceKey, fieldKey })
}

// 字段默认值策略。
function createDefaultValue(definition: EditorPropertyDefinition): unknown {
  if (definition.defaultValue !== undefined) {
    return structuredClone(definition.defaultValue)
  }

  switch (definition.datatype) {
    case 'string':
      return definition.options?.[0] ?? ''
    case 'background':
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
  min-height: 0;
  overflow-y: auto;
  padding: var(--oc-space-2);
}

.empty-hint {
  color: var(--oc-text-dim);
  font-size: var(--oc-body-size);
  text-align: center;
  padding: var(--oc-space-5);
}

.source-section + .source-section {
  margin-top: var(--oc-space-4);
}

.source-title {
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  color: var(--oc-text-label);
  padding-bottom: var(--oc-space-1);
  margin-bottom: var(--oc-space-2);
  border-bottom: 1px solid var(--oc-border-muted);
}

.category {
  display: flex;
  flex-direction: column;
  gap: var(--oc-space-1);
}

.category + .category {
  margin-top: var(--oc-space-3);
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  padding-bottom: var(--oc-space-1);
  border-bottom: 1px solid var(--oc-border-muted);
}

.category-title {
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  color: var(--oc-text-muted);
}

.add-field-menu {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
  position: relative;
}

.add-field-count {
  min-width: var(--oc-space-3);
  font-size: var(--oc-label-size);
  color: var(--oc-text-muted);
  text-align: right;
}

.entry-control {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.add-field-button,
.reset-field-button {
  flex-shrink: 0;
}
</style>
