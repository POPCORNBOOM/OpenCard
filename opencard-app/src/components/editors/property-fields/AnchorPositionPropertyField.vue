<template>
  <OcOptionGroup
    class="anchor-grid"
    :options="anchorOptions"
    :model-value="currentValue"
    aria-label="Anchor position"
    :columns="3"
    :disabled="definition.isReadonly"
    :square="true"
    @update:modelValue="emit('update:value', $event)"
  >
    <template #option>
      <span class="anchor-dot" />
    </template>
  </OcOptionGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcOptionGroup from '../../base/OcOptionGroup.vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

const anchorOptions = [
  { value: 'lt', label: 'Left Top' },
  { value: 'ct', label: 'Center Top' },
  { value: 'rt', label: 'Right Top' },
  { value: 'lc', label: 'Left Center' },
  { value: 'cc', label: 'Center Center' },
  { value: 'rc', label: 'Right Center' },
  { value: 'lb', label: 'Left Bottom' },
  { value: 'cb', label: 'Center Bottom' },
  { value: 'rb', label: 'Right Bottom' },
] as const

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'anchorPosition' }>
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
.anchor-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
</style>
