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
              class="property-editor__row">
              <div class="property-editor__row-label">
                <OcIcon :name="getEditorIconClass(entry.definition.datatype)" />
                <OcText class="property-editor__row-label-text" :truncate="true">{{ entry.label }}</OcText>
                <OcButton class="modified-field-button" icon-only size="sm" radius="full"
                  v-if="entry.definition.resettable"
                  variant="ghost" icon="action.discard" :title="resetFieldActionText"
                  :aria-label="resetFieldActionText"
                  @click.stop="emitResetProperty(category.inputKey, entry.key)"
                />
              </div>
              <div class="entry-control">
                <component :is="getEditorComponent(entry.definition.datatype, entry.definition)" :definition="entry.definition"
                  :value="entry.value" v-bind="getEditorRuntimeProps(entry.definition, category.inputKey)"
                  @update:value="emit('update-property', { key: category.inputKey, fieldKey: entry.key, value: $event })" />
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
import { computed, toRef, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  type PropertyEditorInput,
} from '../../entities/card/model'
import {
  type EditorPropertyDefinition,
  type PropertyDatatype,
} from '../../entities/card/schema'
import AlignPositionPropertyField from './property-fields/AlignPositionPropertyField.vue'
import BooleanPropertyField from './property-fields/BooleanPropertyField.vue'
import AnchorPositionPropertyField from './property-fields/AnchorPositionPropertyField.vue'
import ColorPropertyField from './property-fields/ColorPropertyField.vue'
import FilePathPropertyField from './property-fields/FilePathPropertyField.vue'
import FlowDirectionPropertyField from './property-fields/FlowDirectionPropertyField.vue'
import NumberPropertyField from './property-fields/NumberPropertyField.vue'
import ObjectPropertyField from './property-fields/ObjectPropertyField.vue'
import StringPropertyField from './property-fields/StringPropertyField.vue'
import ReferenceStringPropertyField from './property-fields/ReferenceStringPropertyField.vue'
import VerticalAlignPositionPropertyField from './property-fields/VerticalAlignPositionPropertyField.vue'
import {
  useCdePropertyEditorView,
  type CdePropertyEditorCategory,
} from '../../composables/useCdePropertyEditorView'
import type { CdePropertySortMode } from '../../composables/useCdePropertyPanelState'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import type { ReferenceCompletionContext } from '../../features/editor-runtime/services/referenceCompletion'
import { OcButton, OcEmpty } from '../base'
import OcActionButton, { type OcActionButtonAction } from '../standard/OcActionButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcPanel from '../base/OcPanel.vue'

// 输出事件协议。
type PropertyEditorMutation = {
  key: string
  fieldKey: string
  value: unknown
}

type PropertyEditorResetMutation = {
  key: string
  fieldKey: string
}

const emit = defineEmits<{
  (e: 'update-property', payload: PropertyEditorMutation): void
  (e: 'add-property', payload: PropertyEditorMutation): void
  (e: 'reset-property', payload: PropertyEditorResetMutation): void
}>()

// 组件输入协议。
const props = defineProps<{
  inputs: PropertyEditorInput[]
  sortMode: CdePropertySortMode
  referenceContexts?: Readonly<Record<string, ReferenceCompletionContext>>
}>()

// 运行时依赖与编辑器映射。
type DatatypeEditorEntry = {
  component: Component
  icon: IconToken
}

const datatypeEditorMap: Record<PropertyDatatype, DatatypeEditorEntry> = {
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
const ADD_PROPERTY_ACTION_KEY = 'add-property'
const ADD_PROPERTY_FIELD_ACTION_PREFIX = 'add-property:'

const { displaySources } = useCdePropertyEditorView({
  inputs: toRef(props, 'inputs'),
  sortMode: toRef(props, 'sortMode'),
  translate: (messageKey) => t(messageKey),
  hasMessage: (messageKey) => te(messageKey),
})

function getEditorComponent(datatype: PropertyDatatype, definition?: EditorPropertyDefinition): Component {
  if (datatype === 'string' && definition?.referenceInput) {
    return ReferenceStringPropertyField
  }
  return (datatypeEditorMap[datatype] ?? datatypeEditorMap.string).component
}

function getEditorRuntimeProps(
  definition: EditorPropertyDefinition,
  sourceKey: string,
): Record<string, unknown> {
  if (definition.datatype === 'string' && definition.referenceInput) {
    return {
      referenceContext: props.referenceContexts?.[sourceKey],
    }
  }

  return {}
}

function getEditorIconClass(datatype: PropertyDatatype): IconToken {
  return (datatypeEditorMap[datatype] ?? datatypeEditorMap.string).icon
}

// 添加字段与重置交互。
function resolveCategoryActions(category: CdePropertyEditorCategory): OcActionButtonAction[] {
  if (category.addableFields.length === 0) {
    return []
  }

  return [
    {
      key: ADD_PROPERTY_ACTION_KEY,
      icon: 'action.add',
      title: `${addFieldActionText.value} (${category.addableFields.length})`,
      children: category.addableFields.map((field) => ({
        key: `${ADD_PROPERTY_FIELD_ACTION_PREFIX}${field.key}`,
        icon: getEditorIconClass(field.definition.datatype),
        title: field.label,
      })),
    },
  ]
}

function handleCategoryAction(payload: { key: string }, category: CdePropertyEditorCategory): void {
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

function emitResetProperty(key: string, fieldKey: string): void {
  emit('reset-property', { key, fieldKey })
}

// 字段默认值策略。
function createDefaultValue(definition: EditorPropertyDefinition): unknown {
  if (definition.defaultValue !== undefined) {
    return structuredClone(definition.defaultValue)
  }

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
    case 'verticalAlignPosition':
      return 'top'
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
