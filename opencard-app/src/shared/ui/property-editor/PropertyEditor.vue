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
  <div ref="propertyEditorRoot" class="property-editor" @pointerdown.capture="handleEditorPointerDown"
    @keydown.esc="armedDeleteKey = null">
    <OcEmpty v-if="inputs.length === 0">选择一个对象查看属性</OcEmpty>
    <template v-else>
      <OcPanel padding="none" border="none" tone="transparent" gap="none">
        <section v-for="source in displaySources" :key="source.key" class="property-editor__source">
          <header class="property-editor__source-header">
            <span class="property-editor__icon-slot" aria-hidden="true">
              <OcIcon name="data.symbol-class" tone="muted" />
            </span>
            <OcText class="property-editor__source-title" :truncate="true">{{ source.title }}</OcText>
          </header>

          <section v-for="category in source.categories" :key="`${source.key}:${category.key}`"
            class="property-editor__category">
            <header class="property-editor__category-header">
              <span class="property-editor__category-indent" aria-hidden="true" />
              <span class="property-editor__icon-slot" aria-hidden="true">
                <OcIcon :name="category.icon" tone="muted" />
              </span>
              <OcText class="property-editor__category-title" :truncate="true">{{ category.title }}</OcText>
              <span class="property-editor__category-actions">
                <OcActionButton v-for="action in resolveCategoryActions(category)" :key="action.key"
                  :action="action" size="sm" variant="ghost"
                  @select="handleCategoryAction($event, category)" />
              </span>
            </header>

            <div class="property-editor__fields">
            <div v-for="entry in category.entries" :key="`${source.key}:${category.key}:${entry.key}`"
              class="property-editor__row"
              :class="{ 'is-revealed': revealedFieldIdentity === fieldIdentity(category.inputKey, entry.key) }"
              :data-input-key="category.inputKey" :data-field-key="entry.key">
              <div class="property-editor__row-label">
                <OcIcon :name="getEditorIconClass(entry.definition.fieldType)" />
                <OcText class="property-editor__row-label-text" :truncate="true">{{ entry.label }}</OcText>
                <OcButton class="modified-field-button" icon-only size="sm" radius="full"
                  v-if="entry.definition.resettable"
                  variant="ghost" icon="action.discard" :title="resetFieldActionText"
                  :aria-label="resetFieldActionText"
                  @click.stop="emitResetProperty(category.inputKey, entry.key)"
                />
                <OcButton v-if="entry.definition.deletable" class="delete-field-button"
                  :class="{ 'is-armed': isDeleteArmed(category.inputKey, entry.key) }"
                  icon-only size="sm" variant="ghost" icon="action.delete"
                  :title="isDeleteArmed(category.inputKey, entry.key) ? confirmDeleteFieldActionText : deleteFieldActionText"
                  :aria-label="isDeleteArmed(category.inputKey, entry.key) ? confirmDeleteFieldActionText : deleteFieldActionText"
                  @click.stop="handleDeleteField(category.inputKey, entry.key)" />
              </div>
              <div class="entry-control">
                <ReferenceStringPropertyField
                  v-if="usesRawStringEditor(category.inputKey, entry.key, entry.value, entry.definition)"
                  :definition="toRawStringDefinition(entry.definition)"
                  :value="entry.value"
                  @update:value="emitRawStringValue(category.inputKey, entry.key, $event)" />
                <ArrayPropertyField
                  v-else-if="isArrayPropertyFieldType(entry.definition.fieldType)"
                  :definition="entry.definition"
                  :element-component="getArrayElementComponent(entry.definition.fieldType)"
                  :element-definition="toArrayElementDefinition(entry.definition)"
                  :value="entry.value"
                  @update:value="emitPropertyValue(category.inputKey, entry.key, $event)"
                />
                <component v-else :is="getEditorComponent(entry.definition.fieldType, entry.definition)"
                  :definition="entry.definition" :value="entry.value"
                  @update:value="emitPropertyValue(category.inputKey, entry.key, $event)" />
                <OcButton v-if="canToggleRawStringEditor(entry.definition) && !isBindingValue(entry.value)"
                  class="raw-string-toggle"
                  icon-only size="sm" variant="ghost"
                  :icon="usesRawStringEditor(category.inputKey, entry.key, entry.value, entry.definition)
                    ? getEditorIconClass(entry.definition.fieldType)
                    : 'data.variable'"
                  :title="usesRawStringEditor(category.inputKey, entry.key, entry.value, entry.definition)
                    ? useFieldEditorText
                    : useRawStringEditorText"
                  :aria-label="usesRawStringEditor(category.inputKey, entry.key, entry.value, entry.definition)
                    ? useFieldEditorText
                    : useRawStringEditorText"
                  @click="toggleRawStringEditor(category.inputKey, entry.key)" />
              </div>
            </div>
            </div>
          </section>
        </section>
      </OcPanel>
    </template>
  </div>

</template>

<script setup lang="ts">
// Vue 基础能力与依赖组件。
import { computed, nextTick, onBeforeUnmount, ref, toRef, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  PropertyEditorBindingInterpreter,
  PropertyEditorCategoryDefinition,
  PropertyEditorFieldDefinition,
  PropertyEditorFieldIntent,
  PropertyEditorInput,
  PropertyEditorMutation,
  PropertyEditorSortMode,
  BasePropertyFieldType,
  PropertyFieldType,
} from './propertyEditor.types'
import {
  getArrayElementFieldType,
  isArrayPropertyFieldType,
} from './propertyEditor.types'
import AlignPositionPropertyField from './fields/AlignPositionPropertyField.vue'
import BooleanPropertyField from './fields/BooleanPropertyField.vue'
import AnchorPositionPropertyField from './fields/AnchorPositionPropertyField.vue'
import ColorPropertyField from './fields/ColorPropertyField.vue'
import FilePathPropertyField from './fields/FilePathPropertyField.vue'
import FlowDirectionPropertyField from './fields/FlowDirectionPropertyField.vue'
import NumberPropertyField from './fields/NumberPropertyField.vue'
import ObjectPropertyField from './fields/ObjectPropertyField.vue'
import StringPropertyField from './fields/StringPropertyField.vue'
import ReferenceStringPropertyField from './fields/ReferenceStringPropertyField.vue'
import VerticalAlignPositionPropertyField from './fields/VerticalAlignPositionPropertyField.vue'
import ArrayPropertyField from './fields/ArrayPropertyField.vue'
import {
  usePropertyEditorView,
  type PropertyEditorCategoryView,
} from './usePropertyEditorView'
import type { IconToken } from '../icon/iconRegistry'
import OcButton from '../../../components/base/OcButton.vue'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import OcActionButton, { type OcActionButtonAction } from '../../../components/standard/OcActionButton.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcText from '../../../components/base/OcText.vue'
import OcPanel from '../../../components/base/OcPanel.vue'

// 输出事件协议。
const emit = defineEmits<{
  (e: 'update-property', payload: PropertyEditorMutation): void
  (e: 'add-property', payload: PropertyEditorMutation): void
  (e: 'reset-property', payload: PropertyEditorFieldIntent): void
  (e: 'delete-property', payload: PropertyEditorFieldIntent): void
}>()

// 组件输入协议。
const props = defineProps<{
  inputs: readonly PropertyEditorInput[]
  categories?: ReadonlyMap<string, PropertyEditorCategoryDefinition>
  sortMode: PropertyEditorSortMode
  bindingInterpreter?: PropertyEditorBindingInterpreter
}>()

// 运行时依赖与编辑器映射。
type FieldTypeEditorEntry = {
  component: Component
  icon: IconToken
}

const fieldTypeEditorMap: Record<BasePropertyFieldType, FieldTypeEditorEntry> = {
  string: { component: StringPropertyField, icon: 'data.symbol-string' },
  anchorPosition: { component: AnchorPositionPropertyField, icon: 'nav.compass' },
  alignPosition: { component: AlignPositionPropertyField, icon: 'data.list-selection' },
  verticalAlignPosition: { component: VerticalAlignPositionPropertyField, icon: 'data.layers' },
  flowDirection: { component: FlowDirectionPropertyField, icon: 'nav.arrow-right' },
  number: { component: NumberPropertyField, icon: 'data.symbol-number' },
  boolean: { component: BooleanPropertyField, icon: 'data.symbol-boolean' },
  color: { component: ColorPropertyField, icon: 'data.symbol-color' },
  filePath: { component: FilePathPropertyField, icon: 'file.generic' },
  object: { component: ObjectPropertyField, icon: 'data.symbol-class' },
}

const { t, te } = useI18n()

function resolveLocalizedText(messageKey: string, fallback: string): string {
  if (te(messageKey)) {
    return t(messageKey)
  }

  return fallback
}

const addFieldActionText = computed(() =>
  resolveLocalizedText('propertyEditor.actions.addField', 'Add Field')
)
const resetFieldActionText = computed(() =>
  resolveLocalizedText('propertyEditor.actions.reset', 'Reset')
)
const deleteFieldActionText = computed(() => resolveLocalizedText('propertyEditor.actions.delete', 'Delete'))
const confirmDeleteFieldActionText = computed(() => resolveLocalizedText('propertyEditor.actions.confirmDelete', 'Click again to delete'))
const useRawStringEditorText = computed(() => t('propertyEditor.bindings.useRawEditor'))
const useFieldEditorText = computed(() => t('propertyEditor.bindings.useFieldEditor'))
const ADD_PROPERTY_ACTION_KEY = 'add-property'
const ADD_PROPERTY_FIELD_ACTION_PREFIX = 'add-property:'
const armedDeleteKey = ref<string | null>(null)
const rawStringEditorKeys = ref<ReadonlySet<string>>(new Set())
const propertyEditorRoot = ref<HTMLElement | null>(null)
const revealedFieldIdentity = ref<string | null>(null)
let revealHighlightTimer: ReturnType<typeof setTimeout> | null = null

const { displaySources } = usePropertyEditorView({
  inputs: toRef(props, 'inputs'),
  categories: computed(() => props.categories ?? new Map()),
  sortMode: toRef(props, 'sortMode'),
  otherCategory: computed(() => ({
    title: resolveLocalizedText('propertyEditor.categories.other', 'Other'),
    icon: 'data.list-tree',
  })),
})

function getEditorComponent(fieldType: PropertyFieldType, definition?: PropertyEditorFieldDefinition): Component {
  if (definition?.fieldType === 'string'
    && definition
    && !definition.options
    && definition.completion?.provider) {
    return ReferenceStringPropertyField
  }
  if (isArrayPropertyFieldType(fieldType)) return ArrayPropertyField
  return (fieldTypeEditorMap[fieldType] ?? fieldTypeEditorMap.string).component
}

function getArrayElementComponent(fieldType: PropertyFieldType): Component {
  if (!isArrayPropertyFieldType(fieldType)) return fieldTypeEditorMap.string.component
  return fieldTypeEditorMap[getArrayElementFieldType(fieldType)].component
}

function getScalarDefaultValue(fieldType: BasePropertyFieldType): unknown {
  if (fieldType === 'boolean') return 'false'
  if (fieldType === 'number') return '0'
  if (fieldType === 'object') return {}
  return ''
}

function toArrayElementDefinition(
  definition: PropertyEditorFieldDefinition,
): Extract<PropertyEditorFieldDefinition, { fieldType: BasePropertyFieldType }> {
  if (!isArrayPropertyFieldType(definition.fieldType)) {
    throw new Error(`Expected an array field type, received "${definition.fieldType}"`)
  }
  const fieldType = getArrayElementFieldType(definition.fieldType)
  return {
    ...definition,
    fieldType,
    defaultValue: getScalarDefaultValue(fieldType),
  } as Extract<PropertyEditorFieldDefinition, { fieldType: BasePropertyFieldType }>
}

function usesInlineBindingEditor(definition: PropertyEditorFieldDefinition): boolean {
  return definition.fieldType === 'string'
    && !definition.options
    && Boolean(definition.completion?.provider)
}

function canToggleRawStringEditor(definition: PropertyEditorFieldDefinition): boolean {
  return !isArrayPropertyFieldType(definition.fieldType)
    && Boolean(definition.binding?.provider)
    && !usesInlineBindingEditor(definition)
}

function toRawStringDefinition(
  definition: PropertyEditorFieldDefinition,
): Extract<PropertyEditorFieldDefinition, { fieldType: 'string' }> {
  const { options: _options, ...baseDefinition } = definition as PropertyEditorFieldDefinition & {
    options?: readonly string[]
  }
  return {
    ...baseDefinition,
    fieldType: 'string',
  }
}

function isBindingValue(value: unknown): boolean {
  return props.bindingInterpreter?.isExpression(value) ?? false
}

function emitPropertyValue(sourceKey: string, fieldKey: string, value: unknown): void {
  emit('update-property', { key: sourceKey, fieldKey, value })
}

function emitRawStringValue(sourceKey: string, fieldKey: string, value: string): void {
  const identity = rawStringEditorIdentity(sourceKey, fieldKey)
  if (!rawStringEditorKeys.value.has(identity)) {
    rawStringEditorKeys.value = new Set([...rawStringEditorKeys.value, identity])
  }
  emitPropertyValue(sourceKey, fieldKey, value)
}

function rawStringEditorIdentity(sourceKey: string, fieldKey: string): string {
  return fieldIdentity(sourceKey, fieldKey)
}

function fieldIdentity(inputKey: string, fieldKey: string): string {
  return `${inputKey}\u0000${fieldKey}`
}

function usesRawStringEditor(
  sourceKey: string,
  fieldKey: string,
  value: unknown,
  definition: PropertyEditorFieldDefinition,
): boolean {
  return canToggleRawStringEditor(definition)
    && (isBindingValue(value) || rawStringEditorKeys.value.has(rawStringEditorIdentity(sourceKey, fieldKey)))
}

function toggleRawStringEditor(sourceKey: string, fieldKey: string): void {
  const identity = rawStringEditorIdentity(sourceKey, fieldKey)
  const nextKeys = new Set(rawStringEditorKeys.value)
  if (nextKeys.has(identity)) {
    nextKeys.delete(identity)
  } else {
    nextKeys.add(identity)
  }
  rawStringEditorKeys.value = nextKeys
}

function getEditorIconClass(fieldType: PropertyFieldType): IconToken {
  const resolvedType = isArrayPropertyFieldType(fieldType)
    ? getArrayElementFieldType(fieldType)
    : fieldType
  return (fieldTypeEditorMap[resolvedType] ?? fieldTypeEditorMap.string).icon
}

// 添加字段与重置交互。
function resolveCategoryActions(category: PropertyEditorCategoryView): OcActionButtonAction[] {
  const actions: OcActionButtonAction[] = []
  if (category.addableFields.length > 0) {
    actions.push({
      key: ADD_PROPERTY_ACTION_KEY,
      icon: 'action.add',
      title: `${addFieldActionText.value} (${category.addableFields.length})`,
      children: category.addableFields.map((field) => ({
        key: `${ADD_PROPERTY_FIELD_ACTION_PREFIX}${field.key}`,
        icon: getEditorIconClass(field.definition.fieldType),
        title: field.label,
      })),
    })
  }

  return actions
}

function handleCategoryAction(payload: { key: string }, category: PropertyEditorCategoryView): void {
  if (!payload.key.startsWith(ADD_PROPERTY_FIELD_ACTION_PREFIX)) {
    return
  }

  const fieldKey = payload.key.slice(ADD_PROPERTY_FIELD_ACTION_PREFIX.length)
  const field = category.addableFields.find((item) => item.key === fieldKey)
  if (!field) {
    return
  }

  emit('add-property', {
    key: category.inputKey,
    fieldKey: field.key,
    value: createDefaultValue(field.definition),
  })
}

function deleteIdentity(sourceKey: string, fieldKey: string): string {
  return fieldIdentity(sourceKey, fieldKey)
}

function isDeleteArmed(sourceKey: string, fieldKey: string): boolean {
  return armedDeleteKey.value === deleteIdentity(sourceKey, fieldKey)
}

function handleDeleteField(sourceKey: string, fieldKey: string): void {
  const identity = deleteIdentity(sourceKey, fieldKey)
  if (armedDeleteKey.value !== identity) {
    armedDeleteKey.value = identity
    return
  }
  armedDeleteKey.value = null
  emit('delete-property', { key: sourceKey, fieldKey })
}

function handleEditorPointerDown(event: PointerEvent): void {
  const target = event.target
  if (!(target instanceof Element) || !target.closest('.delete-field-button')) {
    armedDeleteKey.value = null
  }
}

function emitResetProperty(key: string, fieldKey: string): void {
  emit('reset-property', { key, fieldKey })
}

// 字段默认值策略。
function createDefaultValue(definition: PropertyEditorFieldDefinition): unknown {
  if (isArrayPropertyFieldType(definition.fieldType)) return []
  return structuredClone(definition.defaultValue)
}

function findFieldRow(inputKey: string, fieldKey: string): HTMLElement | null {
  const rows = propertyEditorRoot.value?.querySelectorAll<HTMLElement>(
    '.property-editor__row[data-input-key][data-field-key]',
  ) ?? []
  return Array.from(rows).find((row) =>
    row.dataset.inputKey === inputKey && row.dataset.fieldKey === fieldKey
  ) ?? null
}

function toCodeUnitOffset(value: string, characterOffset: number): number {
  return Array.from(value).slice(0, characterOffset).join('').length
}

function focusFieldControl(row: HTMLElement, characterOffset?: number): void {
  const control = row.querySelector<HTMLElement>(
    '.entry-control input:not([type="hidden"]), .entry-control textarea, .entry-control select, '
      + '.entry-control button:not([disabled]), .entry-control [tabindex]:not([tabindex="-1"])',
  )
  control?.focus()
  if (
    characterOffset !== undefined
    && (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)
  ) {
    const selectionOffset = toCodeUnitOffset(control.value, characterOffset)
    try {
      control.setSelectionRange(selectionOffset, selectionOffset)
    } catch {
      // Some non-text input types expose setSelectionRange but reject calls.
    }
  }
}

async function revealField(
  inputKey: string,
  fieldKey: string,
  characterOffset?: number,
): Promise<boolean> {
  await nextTick()
  const row = findFieldRow(inputKey, fieldKey)
  if (!row) return false

  row.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  focusFieldControl(row, characterOffset)
  revealedFieldIdentity.value = fieldIdentity(inputKey, fieldKey)
  if (revealHighlightTimer) clearTimeout(revealHighlightTimer)
  revealHighlightTimer = setTimeout(() => {
    revealedFieldIdentity.value = null
    revealHighlightTimer = null
  }, 1600)
  return true
}

defineExpose({ revealField })

onBeforeUnmount(() => {
  if (revealHighlightTimer) clearTimeout(revealHighlightTimer)
})
</script>

<style scoped>
.property-editor {
  container-type: inline-size;
  min-width: 0;
  padding: 0;
  font-family: var(--oc-font-sans);
  font-size: var(--oc-text-base);
  line-height: 1.4;
}

.property-editor__source {
  min-width: 0;
}

.property-editor__source + .property-editor__source {
  border-top: 1px solid var(--oc-border-muted);
}

.property-editor__source-header,
.property-editor__category-header {
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
  height: var(--oc-size-md);
  padding: 0 var(--oc-space-2);
}

.property-editor__source-header {
  color: var(--oc-fg-default);
  font-weight: 600;
}

.property-editor__category-header {
  color: var(--oc-fg-muted);
  transition: background-color var(--oc-duration-fast) var(--oc-ease);
}

.property-editor__category-header:hover,
.property-editor__category-header:focus-within {
  background: var(--oc-bg-hover);
}

.property-editor__category-indent {
  width: 12px;
  flex: 0 0 12px;
}

.property-editor__icon-slot {
  display: inline-flex;
  flex: 0 0 16px;
  width: 16px;
  align-items: center;
  justify-content: center;
  margin-right: var(--oc-space-2);
}

.property-editor__source-title,
.property-editor__category-title {
  min-width: 0;
  flex: 1 1 auto;
}

.property-editor__category-title {
  font-size: var(--oc-text-sm);
}

.property-editor__category-actions {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  opacity: 0;
  transition: opacity var(--oc-duration-fast) var(--oc-ease);
}

.property-editor__category-header:hover .property-editor__category-actions,
.property-editor__category-header:focus-within .property-editor__category-actions {
  opacity: 1;
}

.property-editor__fields {
  min-width: 0;
}

.property-editor__row {
  display: grid;
  grid-template-columns: minmax(76px, 88px) minmax(0, 1fr);
  align-items: start;
  gap: var(--oc-space-3);
  width: 100%;
  min-width: 0;
  min-height: var(--oc-property-row-height);
  padding: 0 var(--oc-space-2) 0 32px;
  box-sizing: border-box;
  transition: background-color var(--oc-duration-fast) var(--oc-ease);
}

.property-editor__row:hover,
.property-editor__row:focus-within {
  background: var(--oc-bg-hover);
}

.property-editor__row.is-revealed {
  background: var(--oc-bg-selected);
  box-shadow: inset 2px 0 0 var(--oc-fg-accent);
}

.property-editor__row-label {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
  min-width: 0;
  min-height: var(--oc-property-row-height);
  overflow: hidden;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.property-editor__row-label-text {
  min-width: 0;
}

.entry-control {
  margin: var(--oc-space-1) 0;
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--oc-space-2);
}

.entry-control > * {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
}

.entry-control > .raw-string-toggle {
  flex: 0 0 auto;
  width: var(--oc-size-sm);
}

.modified-field-button {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  padding: 0;
  color: var(--oc-fg-accent);
}

.modified-field-button::before {
  content: '';
  position: absolute;
  width: 6px;
  height: 6px;
  border: 1px solid currentColor;
  border-radius: 50%;
  box-sizing: border-box;
  opacity: .8;
}

.modified-field-button :deep(.oc-button__icon) {
  opacity: 0;
}

.modified-field-button:hover::before,
.modified-field-button:focus-visible::before {
  opacity: 0;
}

.modified-field-button:hover :deep(.oc-button__icon),
.modified-field-button:focus-visible :deep(.oc-button__icon) {
  opacity: 1;
}

.delete-field-button {
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  color: var(--oc-fg-muted);
}

.delete-field-button.is-armed {
  color: var(--oc-fg-danger);
  background: var(--oc-bg-hover);
}

@media (hover: none) {
  .property-editor__category-actions {
    opacity: 1;
  }
}

@container (max-width: 280px) {
  .property-editor__row {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--oc-space-1);
  }
}
</style>
