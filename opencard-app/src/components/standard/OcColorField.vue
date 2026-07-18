<!-- Standard 颜色字段：色块取色器与文本值共享同一字段表面。 -->
<template>
  <OcFieldFrame class="oc-color-field" full-width :disabled="disabled">
    <template #prefix>
      <label class="oc-color-field__swatch" title="Choose color">
        <span class="oc-color-field__preview" :style="{ backgroundColor: pickerValue }" />
        <input class="oc-color-field__picker" type="color" :value="pickerValue" :disabled="disabled"
          aria-label="Choose color" @input="handleInput" />
      </label>
    </template>
    <OcFieldInput as="input" variant="plain" full-width :value="modelValue" :disabled="disabled"
      spellcheck="false" @input="handleInput" />
  </OcFieldFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'

interface Props {
  modelValue?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

defineOptions({ name: 'OcColorField' })

const pickerValue = computed(() => toHexColor(props.modelValue) ?? '#000000')

function handleInput(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('update:modelValue', target.value)
}

function toHexColor(value: string): string | null {
  const trimmed = value.trim()
  if (/^#[\da-fA-F]{6}$/.test(trimmed)) return trimmed
  if (/^#[\da-fA-F]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
  }
  return null
}
</script>

<style scoped>
.oc-color-field__swatch {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: calc(var(--oc-size-md) - 2px);
  padding: 3px;
  border-right: 1px solid var(--oc-border-muted);
  box-sizing: border-box;
  cursor: pointer;
}

.oc-color-field__preview {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--oc-border-strong) 55%, transparent);
}

.oc-color-field__picker {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.oc-color-field__picker:disabled { cursor: default; }

.oc-color-field :deep(.oc-field-input) {
  height: 100%;
  min-height: 0;
  padding: var(--oc-space-1) var(--oc-space-2);
}

.oc-color-field :deep(.oc-field-input:focus),
.oc-color-field :deep(.oc-field-input:focus-visible) {
  border-color: transparent;
}
</style>
