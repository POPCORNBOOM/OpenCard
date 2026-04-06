<template>
  <div class="option-grid" role="radiogroup" aria-label="Align position">
    <button
      v-for="option in alignOptions"
      :key="option.value"
      type="button"
      class="option-button"
      :class="{ active: currentValue === option.value }"
      :title="option.label"
      :aria-label="option.label"
      :aria-checked="currentValue === option.value"
      :disabled="definition.isReadonly"
      role="radio"
      @click="emit('update:value', option.value)"
    >
      <span class="codicon" :class="option.icon" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

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

<style scoped>
.option-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.option-button {
  min-width: 0;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #555;
  background: #3c3c3c;
  color: #ccc;
  padding: 0;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.option-button:hover:not(:disabled) {
  border-color: #0e639c;
  background: #2a2d2e;
}

.option-button:disabled {
  cursor: default;
  opacity: 0.7;
}

.option-button.active {
  border-color: #0e639c;
  background: #094771;
}
</style>
