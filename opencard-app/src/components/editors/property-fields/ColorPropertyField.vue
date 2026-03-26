<template>
  <div class="color-field">
    <span class="color-preview" :style="previewStyle" />
    <input
      v-if="definition.enableCss !== false"
      class="prop-input"
      type="text"
      :value="stringValue"
      @input="emit('update:value', ($event.target as HTMLInputElement).value)"
    />
    <input
      v-else
      class="prop-input"
      type="text"
      :value="stringValue"
      readonly
    />
    <input
      v-if="definition.enablePicker"
      class="color-picker"
      type="color"
      :value="pickerValue"
      @input="emit('update:value', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EditorPropertyDefinition } from '../../../core/propertyEditorSchema'

const props = defineProps<{
  definition: Extract<EditorPropertyDefinition, { datatype: 'color' }>
  value: unknown
}>()

const emit = defineEmits<{
  (e: 'update:value', value: string): void
}>()

const stringValue = computed(() => (props.value == null ? '' : String(props.value)))

const pickerValue = computed(() => toHexColor(stringValue.value) ?? '#000000')

const previewStyle = computed(() => ({
  background: isSupportedColor(stringValue.value) ? stringValue.value : 'transparent',
}))

function isSupportedColor(value: string): boolean {
  if (!value) {
    return false
  }

  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value)
  }

  return Boolean(toHexColor(value))
}

function toHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[\da-fA-F]{6}$/.test(trimmed)) {
    return trimmed
  }
  if (/^#[\da-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }
  return null
}
</script>

<style scoped>
.color-field {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.color-preview {
  width: 16px;
  height: 16px;
  border: 1px solid #555;
  background-image:
    linear-gradient(45deg, #666 25%, transparent 25%),
    linear-gradient(-45deg, #666 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #666 75%),
    linear-gradient(-45deg, transparent 75%, #666 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px -4px, -4px 0;
  flex-shrink: 0;
}

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

.color-picker {
  width: 28px;
  height: 24px;
  border: none;
  padding: 0;
  background: transparent;
  flex-shrink: 0;
}
</style>
