<template>
  <OcFieldInput
    as="input"
    type="number"
    :value="numberValue"
    :min="definition.min"
    :max="definition.max"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcFieldInput from '../../base/OcFieldInput.vue'
import type { EditorPropertyDefinition } from '../../../entities/card/schema'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'number' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: unknown): void
}>()

const numberValue = computed(() => (typeof props.value === 'number' ? props.value : undefined))

function onInput(event: Event) {
  const rawValue = (event.target as HTMLInputElement).value
  if (rawValue === '') {
    emit('update:value', props.value)
    return
  }

  const nextValue = Number(rawValue)
  emit('update:value', Number.isFinite(nextValue) ? nextValue : props.value)
}
</script>
