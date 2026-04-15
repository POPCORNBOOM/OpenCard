<template>
  <OcOptionGroup
    :options="directionOptions"
    :model-value="currentValue"
    aria-label="Flow direction"
    :columns="4"
    :disabled="definition.isReadonly"
    @update:modelValue="emit('update:value', $event)"
  >
    <template #option="{ option }">
      <span class="option-label">{{ option.shortLabel }}</span>
    </template>
  </OcOptionGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcOptionGroup from '../../base/OcOptionGroup.vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

const directionOptions = [
  { value: 'lr', label: 'Left to Right', shortLabel: 'L→R' },
  { value: 'rl', label: 'Right to Left', shortLabel: 'R→L' },
  { value: 'tb', label: 'Top to Bottom', shortLabel: 'T↓B' },
  { value: 'bt', label: 'Bottom to Top', shortLabel: 'B↑T' },
] as const

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'flowDirection' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const currentValue = computed(() => {
  const value = typeof props.value === 'string' ? props.value : ''
  return directionOptions.some((option) => option.value === value) ? value : 'lr'
})
</script>

<style scoped>
.option-label {
  font-size: var(--oc-label-size);
  font-weight: 600;
}
</style>
