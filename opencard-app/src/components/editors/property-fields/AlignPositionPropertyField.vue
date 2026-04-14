<template>
  <div class="option-grid" role="radiogroup" aria-label="Align position">
    <OcButton
      v-for="option in alignOptions"
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
      <span class="codicon" :class="option.icon" />
    </OcButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from '../../base/OcButton.vue'
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
  min-height: 30px;
  padding: 0;
}

.option-button:hover:not(:disabled) {
  border-color: var(--oc-bg-accent);
}

.option-button.active {
  border-color: var(--oc-bg-accent);
}
</style>
