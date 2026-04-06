<template>
  <div class="anchor-grid" role="radiogroup" aria-label="Anchor position">
    <button
      v-for="option in anchorOptions"
      :key="option.value"
      type="button"
      class="anchor-cell"
      :class="{ active: currentValue === option.value }"
      :title="option.label"
      :aria-label="option.label"
      :aria-checked="currentValue === option.value"
      :disabled="definition.isReadonly"
      role="radio"
      @click="emit('update:value', option.value)"
    >
      <span class="anchor-dot" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
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
.anchor-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.anchor-cell {
  aspect-ratio: 1;
  min-width: 0;
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

.anchor-cell:hover:not(:disabled) {
  border-color: #0e639c;
  background: #2a2d2e;
}

.anchor-cell:disabled {
  cursor: default;
  opacity: 0.7;
}

.anchor-cell.active {
  border-color: #0e639c;
  background: #094771;
}

.anchor-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
</style>
