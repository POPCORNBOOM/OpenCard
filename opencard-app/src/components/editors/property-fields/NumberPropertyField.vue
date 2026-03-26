<template>
  <input
    class="prop-input"
    type="number"
    :value="numberValue"
    :min="definition.min"
    :max="definition.max"
    @input="onInput"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

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

<style scoped>
.prop-input {
  flex: 1;
  background: #3c3c3c;
  border: 1px solid #555;
  color: #ccc;
  padding: 2px 6px;
  font-size: 12px;
  min-width: 0;
}

.prop-input:focus {
  border-color: #007acc;
  outline: none;
}
</style>
