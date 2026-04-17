<template>
  <OcOptionGroup
    :options="alignOptions"
    :model-value="currentValue"
    aria-label="Align position"
    :columns="4"
    :disabled="definition.isReadonly"
    @update:modelValue="emit('update:value', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcOptionGroup from '../../base/OcOptionGroup.vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

const alignOptions = [
  { value: 'start', label: 'Start', icon: 'codicon-list-selection' },
  { value: 'center', label: 'Center', icon: 'codicon-symbol-key' },
  { value: 'end', label: 'End', icon: 'codicon-list-selection' },
  { value: 'justify', label: 'Justify', icon: 'codicon-menu' },
] as const

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'alignPosition' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const currentValue = computed(() => {
  const value = typeof props.value === 'string' ? props.value : ''
  return alignOptions.some((option) => option.value === value) ? value : 'start'
})
</script>
