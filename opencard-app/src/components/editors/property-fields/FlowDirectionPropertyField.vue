<template>
  <div class="option-grid" role="radiogroup" aria-label="Flow direction">
    <OcButton
      v-for="option in directionOptions"
      :key="option.value"
      class="option-button"
      variant="choice"
      :class="{ active: currentValue === option.value }"
      :active="currentValue === option.value"
      :title="option.label"
      :aria-label="option.label"
      :aria-checked="currentValue === option.value"
      :disabled="definition.isReadonly"
      role="radio"
      @click="emit('update:value', option.value)"
    >
      <span class="option-label">{{ option.shortLabel }}</span>
    </OcButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from '../../base/OcButton.vue'
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
  min-height: 30px;
  padding: 0 6px;
}

.option-button:hover:not(:disabled) {
  border-color: var(--oc-bg-accent);
}

.option-button.active {
  border-color: var(--oc-bg-accent);
}

.option-label {
  font-size: var(--oc-label-size);
  font-weight: 600;
}
</style>
