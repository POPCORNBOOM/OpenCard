<template>
  <div class="number-slider-field">
    <OcSlider
      class="number-slider-field__slider"
      :model-value="numberValue"
      :min="definition.min"
      :max="definition.max"
      :step="definition.step"
      :ticks="definition.ticks"
      :disabled="definition.isReadonly"
      :value-text="`${numberValue}${definition.suffix ?? ''}`"
      :aria-label="definition.title"
      @preview="emit('preview:value', String($event))"
      @commit="emit('update:value', String($event))"
    />
    <OcText v-if="definition.suffix" class="number-slider-field__value" as="output" size="sm" mono>
      {{ numberValue }}{{ definition.suffix }}
    </OcText>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcText from '../../../../components/base/OcText.vue'
import OcSlider from '../../../../components/standard/OcSlider.vue'
import type { PropertyEditorFieldDefinition } from '../propertyEditor.types'

const props = defineProps<{
  definition: Extract<PropertyEditorFieldDefinition, { fieldType: 'number' }>
  value: unknown
}>()

const emit = defineEmits<{
  'preview:value': [value: string]
  'update:value': [value: string]
}>()

const numberValue = computed(() => {
  const value = Number(props.value)
  if (Number.isFinite(value)) return value
  return props.definition.min ?? 0
})
</script>

<style scoped>
.number-slider-field {
  display: grid;
  width: 100%;
  min-width: 0;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--oc-space-2);
}

.number-slider-field__value {
  min-width: var(--oc-page-editor-value-width);
  text-align: right;
}
</style>
