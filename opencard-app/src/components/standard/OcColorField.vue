<!-- Standard 颜色字段：组合 OcFieldInput 并统一颜色预览与输入行为。 -->
<template>
  <div class="oc-color-field">
    <div
      v-if="preview"
      class="oc-color-field__preview"
      aria-hidden="true"
    >
      <span class="oc-color-field__preview-fill" :style="previewFillStyle" />
    </div>

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
import OcFieldInput from '../base/OcFieldInput.vue'

interface OcColorFieldProps {
  /** 当前颜色值。 */
  modelValue?: string
  /** 是否显示颜色预览块。 */
  preview?: boolean
  /** 是否显示 color picker。 */
  picker?: boolean
  /** 是否显示 CSS 文本输入框。 */
  cssInput?: boolean
  /** 是否禁用字段。 */
  disabled?: boolean
  /** 是否只读。 */
  readonly?: boolean
  /** picker 的 aria-label。 */
  pickerAriaLabel?: string
}

interface OcColorFieldEmits {
  /** 颜色值变化时抛出。 */
  'update:modelValue': [value: string]
}

defineOptions({
  name: 'OcColorField',
})

const props = withDefaults(defineProps<OcColorFieldProps>(), {
  modelValue: '',
  preview: true,
  picker: true,
  cssInput: true,
  disabled: false,
  readonly: false,
  pickerAriaLabel: 'Select color',
})

const emit = defineEmits<OcColorFieldEmits>()

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
  box-sizing: border-box;
  width: var(--oc-space-4);
  height: var(--oc-space-4);
  min-width: var(--oc-space-4);
  flex-shrink: 0;
  overflow: hidden;
  border-radius: var(--oc-radius-sm);
  border: 1px solid var(--oc-border-surface);
  background-color: var(--oc-bg-input);
  background-image:
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
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
