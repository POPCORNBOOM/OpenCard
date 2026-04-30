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
      <OcCard v-for="source in displaySources" :key="source.key" variant="plain" :level="2" :title="source.title">
        <template #content>
          <OcCard v-for="category in source.categories" :key="`${source.key}:${category.key}`" variant="panel"
            :level="2" :title="category.title" :actions="resolveCategoryCardActions(category)"
            @action="handleCategoryCardAction($event, category)">
            <template #content>
              <OcPropertyRow v-for="entry in category.entries" :key="`${source.key}:${category.key}:${entry.key}`"
                :label="entry.label" :label-icon="getEditorIconClass(entry.definition.datatype)">
                <div class="entry-control">
                  <OcButton v-if="entry.definition.resettable" class="reset-field-button" icon-only size="sm"
                    variant="secondary" :title="resetFieldActionText"
                    :aria-label="`${resetFieldActionText}: ${entry.label}`"
                    @click.stop="emitResetProperty(category.inputKey, entry.key)">
                    <OcIcon name="action.discard" size="sm" />
                  </OcButton>
                  <component :is="getEditorComponent(entry.definition.datatype)" :definition="entry.definition"
                    :value="entry.value"
                    @update:value="emit('update-property', { key: category.inputKey, fieldKey: entry.key, value: $event })" />
                </div>
              </OcPropertyRow>
            </template>
          </OcCard>

        </template>



      </OcCard>
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
import {
  useCdePropertyEditorView,
  type CdePropertyEditorCategory,
} from '../../composables/useCdePropertyEditorView'
import type { CdePropertySortMode } from '../../composables/useCdePropertyPanelState'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import { OcButton, OcEmpty, OcPropertyRow } from '../base'
import OcIcon from '../base/OcIcon.vue'
import OcCard, { type OcCardActionDefinition } from '../base/OcCard.vue'

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

const { displaySources } = useCdePropertyEditorView({
  inputs: toRef(props, 'inputs'),
  sortMode: toRef(props, 'sortMode'),
  translate: (messageKey) => t(messageKey),
  hasMessage: (messageKey) => te(messageKey),
})

function getEditorComponent(datatype: PropertyDatatype): Component {
  return (datatypeEditorMap[datatype] ?? datatypeEditorMap.string).component
}

function getEditorIconClass(datatype: PropertyDatatype): IconToken {
  return (datatypeEditorMap[datatype] ?? datatypeEditorMap.string).icon
}

// 添加字段与重置交互。
function resolveCategoryCardActions(category: CdePropertyEditorCategory): OcCardActionDefinition[] {
  if (category.addableFields.length === 0) {
    return []
  }

  return [
    {
      key: 'add-property',
      icon: 'action.add',
      title: `${addFieldActionText.value} (${category.addableFields.length})`,
      children: category.addableFields.map((field) => ({
        key: field.key,
        title: field.label,
        icon: getEditorIconClass(field.definition.datatype),
      })),
    },
  ]
}

function handleCategoryCardAction(payload: { actionKey: string }, category: CdePropertyEditorCategory): void {
  const field = category.addableFields.find((candidate) => candidate.key === payload.actionKey)
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
  min-width: 0;
  padding: 0px;
  font-family: var(--oc-font-family-ui);
  font-size: var(--oc-body-size);
  line-height: 1.4;
}

.entry-control {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.reset-field-button {
  flex-shrink: 0;
}

.source-title,
.category-title {
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
}
</style>
