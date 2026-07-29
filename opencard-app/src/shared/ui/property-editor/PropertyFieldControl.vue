<!-- 通用单字段控件：分派字段编辑器并维护当前 Cell 的源码编辑状态。 -->
<template>
  <div class="property-field-control">
    <ReferenceStringPropertyField
      v-if="usesRawStringEditor"
      :definition="rawStringDefinition"
      :value="value"
      @update:value="emitRawStringValue"
    />
    <ArrayPropertyField
      v-else-if="isArrayPropertyFieldType(definition.fieldType)"
      :definition="definition"
      :element-component="getArrayPropertyElementComponent(definition.fieldType)"
      :element-definition="toArrayPropertyElementDefinition(definition)"
      :value="value"
      @update:value="emit('update:value', $event)"
    />
    <component
      v-else
      :is="getPropertyFieldComponent(definition)"
      :definition="definition"
      :value="value"
      @update:value="emit('update:value', $event)"
    />
    <OcButton
      v-if="canToggleRawStringEditor && !isBindingValue"
      class="raw-string-toggle"
      icon-only
      size="sm"
      variant="ghost"
      :icon="usesRawStringEditor ? getPropertyFieldIcon(definition.fieldType) : 'data.code-string'"
      :data-tooltip="usesRawStringEditor ? useFieldEditorText : useRawStringEditorText"
      :aria-label="usesRawStringEditor ? useFieldEditorText : useRawStringEditorText"
      @click="forceRawStringEditor = !forceRawStringEditor"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import type {
  PropertyEditorBindingInterpreter,
  PropertyEditorFieldDefinition,
} from './propertyEditor.types'
import { isArrayPropertyFieldType } from './propertyEditor.types'
import ArrayPropertyField from './fields/ArrayPropertyField.vue'
import ReferenceStringPropertyField from './fields/ReferenceStringPropertyField.vue'
import {
  getArrayPropertyElementComponent,
  getPropertyFieldComponent,
  getPropertyFieldIcon,
  toArrayPropertyElementDefinition,
} from './propertyFieldRegistry'

defineOptions({ name: 'PropertyFieldControl' })

const props = defineProps<{
  identity: string
  definition: PropertyEditorFieldDefinition
  value: unknown
  bindingInterpreter?: PropertyEditorBindingInterpreter
}>()

const emit = defineEmits<{
  'update:value': [value: unknown]
}>()

const { t } = useI18n()
const forceRawStringEditor = ref(false)
const useRawStringEditorText = computed(() => t('propertyEditor.bindings.useRawEditor'))
const useFieldEditorText = computed(() => t('propertyEditor.bindings.useFieldEditor'))
const usesInlineBindingEditor = computed(() => props.definition.fieldType === 'string'
  && !props.definition.options
  && Boolean(props.definition.completion?.provider))
const canToggleRawStringEditor = computed(() => !isArrayPropertyFieldType(props.definition.fieldType)
  && Boolean(props.definition.binding?.provider)
  && !usesInlineBindingEditor.value)
const isBindingValue = computed(() => props.bindingInterpreter?.isExpression(props.value) ?? false)
const usesRawStringEditor = computed(() => canToggleRawStringEditor.value
  && (isBindingValue.value || forceRawStringEditor.value))
const rawStringDefinition = computed(() => {
  const { options: _options, ...baseDefinition } = props.definition as PropertyEditorFieldDefinition & {
    options?: readonly string[]
  }
  return {
    ...baseDefinition,
    fieldType: 'string' as const,
  }
})

function emitRawStringValue(value: string): void {
  forceRawStringEditor.value = true
  emit('update:value', value)
}

watch(() => props.identity, () => {
  forceRawStringEditor.value = false
})
</script>

<style scoped>
.property-field-control {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--oc-space-2);
}

.property-field-control > * {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
}

.property-field-control > .raw-string-toggle {
  flex: 0 0 auto;
  width: var(--oc-size-sm);
}
</style>
