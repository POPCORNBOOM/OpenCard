<template>
  <OcOptionGroup
    :options="alignOptions"
    :model-value="currentValue"
    aria-label="Align position"
    :columns="4"
    fill
    icon-only
    :disabled="definition.isReadonly"
    @update:modelValue="emit('update:value', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcOptionGroup from '../../standard/OcOptionGroup.vue'
import type { OcOption } from '../../standard/OcOptionGroup.vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

const alignOptions: OcOption[] = [
  { value: 'start', label: 'Start', icon: 'format.align-start' },
  { value: 'center', label: 'Center', icon: 'format.align-center' },
  { value: 'end', label: 'End', icon: 'format.align-end' },
  { value: 'justify', label: 'Justify', icon: 'format.align-justify' },
]

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

