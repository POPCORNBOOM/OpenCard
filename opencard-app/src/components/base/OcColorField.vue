<template>
  <div class="oc-color-field">
    <OcSurface
      v-if="preview"
      class="oc-color-field__preview"
      variant="input"
      radius="sm"
      :bordered="true"
      pattern="checker-preview"
      aria-hidden="true"
    >
      <span class="oc-color-field__preview-fill" :style="previewFillStyle" />
    </OcSurface>

    <OcFieldInput
      v-if="cssInput"
      as="input"
      class="oc-color-field__css-input"
      type="text"
      :value="stringValue"
      :disabled="disabled"
      :readonly="readonly"
      @input="handleCssInput"
    />

    <input
      v-if="picker"
      class="oc-color-field__picker"
      type="color"
      :value="pickerValue"
      :disabled="disabled || readonly"
      :aria-label="pickerAriaLabel"
      @input="handlePickerInput"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OcSurface } from '../../shared/ui/primitives'
import OcFieldInput from './OcFieldInput.vue'

defineOptions({
  name: 'OcColorField',
})

const props = withDefaults(defineProps<{
  modelValue?: string
  preview?: boolean
  picker?: boolean
  cssInput?: boolean
  disabled?: boolean
  readonly?: boolean
  pickerAriaLabel?: string
}>(), {
  modelValue: '',
  preview: true,
  picker: true,
  cssInput: true,
  disabled: false,
  readonly: false,
  pickerAriaLabel: 'Select color',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const HEX_PREFIX = '#'
const PICKER_FALLBACK_VALUE = `${HEX_PREFIX}000000`

const stringValue = computed(() => props.modelValue ?? '')
const pickerValue = computed(() => toHexColor(stringValue.value) ?? PICKER_FALLBACK_VALUE)
const previewFillStyle = computed(() => ({
  background: isSupportedColor(stringValue.value) ? stringValue.value : 'transparent',
}))

function handleCssInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('update:modelValue', target.value)
}

function handlePickerInput(event: Event): void {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('update:modelValue', target.value)
}

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
.oc-color-field {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  flex: 1;
  min-width: 0;
}

.oc-color-field__preview {
  width: var(--oc-space-4);
  height: var(--oc-space-4);
  min-width: var(--oc-space-4);
  flex-shrink: 0;
  overflow: hidden;
}

.oc-color-field__preview-fill {
  display: block;
  width: 100%;
  height: 100%;
}

.oc-color-field__css-input {
  flex: 1;
  min-width: 0;
}

.oc-color-field__picker {
  width: var(--oc-space-6);
  min-width: var(--oc-space-6);
  height: calc(var(--oc-space-5) + var(--oc-space-1));
  padding: 0;
  border: 0;
  border-radius: var(--oc-radius-sm);
  background: transparent;
  flex-shrink: 0;
}

.oc-color-field__picker:disabled {
  cursor: not-allowed;
}
</style>
