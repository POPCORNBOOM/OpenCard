<template>
  <OcOptionGroup
    :options="verticalAlignOptions"
    :model-value="currentValue"
    aria-label="Vertical align position"
    :columns="3"
    fill
    icon-only
    :disabled="definition.isReadonly"
    @update:modelValue="emit('update:value', $event)"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'
import OcOptionGroup, { type OcOption } from '../../standard/OcOptionGroup.vue'

const verticalAlignOptions: OcOption[] = [
  { value: 'top', label: 'Top', icon: 'format.vertical-top' },
  { value: 'center', label: 'Center', icon: 'format.vertical-center' },
  { value: 'bottom', label: 'Bottom', icon: 'format.vertical-bottom' },
]

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { fieldType: 'verticalAlignPosition' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const currentValue = computed(() => {
  const value = typeof props.value === 'string' ? props.value : ''
  return verticalAlignOptions.some((option) => option.value === value) ? value : 'top'
})
</script>
