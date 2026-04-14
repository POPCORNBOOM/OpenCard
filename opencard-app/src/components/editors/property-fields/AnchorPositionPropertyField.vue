<template>
  <div class="anchor-grid" role="radiogroup" aria-label="Anchor position">
    <OcButton
      v-for="option in anchorOptions"
      :key="option.value"
      class="anchor-cell"
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
      <span class="anchor-dot" />
    </OcButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from '../../base/OcButton.vue'
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
  padding: 0;
}

.anchor-cell:hover:not(:disabled) {
  border-color: var(--oc-bg-accent);
}

.anchor-cell.active {
  border-color: var(--oc-bg-accent);
}

.anchor-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}
</style>
