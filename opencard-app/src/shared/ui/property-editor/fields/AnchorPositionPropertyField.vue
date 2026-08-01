<template>
  <div class="anchor-position-field">
    <OcOptionGroup
      class="anchor-grid"
      :options="anchorOptions"
      :model-value="currentValue"
      aria-label="Anchor position"
      :columns="3"
      :disabled="definition.isReadonly"
      square
      fill
      icon-only
      @update:modelValue="emit('update:value', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcOptionGroup from '../../../../components/standard/OcOptionGroup.vue'
import type { OcOption } from '../../../../components/standard/OcOptionGroup.vue'
import type { PropertyEditorFieldDefinition } from '../propertyEditor.types'

const anchorOptions: OcOption[] = [
  { value: 'lt', label: 'Left Top', icon: 'format.anchor-top-left' },
  { value: 'ct', label: 'Center Top', icon: 'format.anchor-top' },
  { value: 'rt', label: 'Right Top', icon: 'format.anchor-top-right' },
  { value: 'lc', label: 'Left Center', icon: 'format.anchor-left' },
  { value: 'cc', label: 'Center Center', icon: 'format.anchor-center' },
  { value: 'rc', label: 'Right Center', icon: 'format.anchor-right' },
  { value: 'lb', label: 'Left Bottom', icon: 'format.anchor-bottom-left' },
  { value: 'cb', label: 'Center Bottom', icon: 'format.anchor-bottom' },
  { value: 'rb', label: 'Right Bottom', icon: 'format.anchor-bottom-right' },
]

const props = defineProps<{
  definition: Extract<PropertyEditorFieldDefinition, { fieldType: 'anchorPosition' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const currentValue = computed(() => {
  const value = typeof props.value === 'string' ? props.value : ''
  return anchorOptions.some((option) => option.value === value) ? value : 'cc'
})
</script>

<style scoped>
.anchor-position-field {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  min-width: 0;
}

.anchor-grid {
  --anchor-grid-max-size: calc(var(--oc-table-row-height) * 3 - var(--oc-border-width));
  width: var(--anchor-grid-max-size);
  max-width: var(--anchor-grid-max-size);
}

</style>
