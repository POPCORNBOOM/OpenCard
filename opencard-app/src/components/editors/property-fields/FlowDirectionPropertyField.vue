<template>
  <div class="option-grid" role="radiogroup" aria-label="Flow direction">
    <button
      v-for="option in directionOptions"
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
      <span class="option-label">{{ option.shortLabel }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
  padding: 0 6px;
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

.option-label {
  font-size: 11px;
  font-weight: 600;
}
</style>
