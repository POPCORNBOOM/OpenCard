<!-- 纯字段 Renderer：按上级指定的 editorId 渲染编辑器，不拥有模式或 Action。 -->
<template>
  <div class="property-field-renderer" :class="`property-field-renderer--${appearance}`">
    <ReferenceStringPropertyField
      v-if="editorId === 'raw-string'"
      :definition="rawStringDefinition"
      :value="value"
      @update:value="emit('update:value', $event)"
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropertyEditorFieldDefinition } from './propertyEditor.types'
import { isArrayPropertyFieldType } from './propertyEditor.types'
import type { PropertyFieldEditorId } from './propertyFieldEditorMode'
import ArrayPropertyField from './fields/ArrayPropertyField.vue'
import ReferenceStringPropertyField from './fields/ReferenceStringPropertyField.vue'
import {
  getArrayPropertyElementComponent,
  getPropertyFieldComponent,
  toArrayPropertyElementDefinition,
} from './propertyFieldRegistry'

defineOptions({ name: 'PropertyFieldRenderer' })

const props = defineProps<{
  definition: PropertyEditorFieldDefinition
  value: unknown
  editorId: PropertyFieldEditorId
  appearance?: 'default' | 'embedded'
}>()

const emit = defineEmits<{
  'update:value': [value: unknown]
}>()

const appearance = computed(() => props.appearance ?? 'default')
const rawStringDefinition = computed(() => {
  const { options: _options, ...baseDefinition } = props.definition as PropertyEditorFieldDefinition & {
    options?: readonly string[]
  }
  return { ...baseDefinition, fieldType: 'string' as const }
})
</script>

<style scoped>
.property-field-renderer {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: flex-start;
}

.property-field-renderer > * {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
}

.property-field-renderer--embedded {
  --oc-field-surface-background: transparent;
  --oc-field-surface-border-width: 0;
  --oc-field-surface-border-color: transparent;
  --oc-field-surface-border-radius: 0;
  --oc-field-surface-hover-border-color: transparent;
  --oc-field-surface-focus-border-color: transparent;
  --oc-field-surface-focus-shadow: none;
  --oc-field-invalid-border-color: transparent;
  --oc-field-readonly-background: transparent;
  --oc-field-content-padding: 0;
  --oc-field-control-gap: 0;
  --oc-control-border-radius: 0;
  --oc-control-icon-border-radius: 0;
  --oc-control-focus-shadow: none;

  height: 100%;
  align-items: stretch;
}
</style>
