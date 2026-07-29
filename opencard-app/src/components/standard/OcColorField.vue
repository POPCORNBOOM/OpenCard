<!-- Standard 颜色字段：色块取色器与文本值共享同一字段表面。 -->
<template>
  <OcFieldFrame class="oc-color-field" full-width :disabled="disabled" :invalid="invalidDraft">
    <template #prefix>
      <span class="oc-color-field__swatch">
        <OcColorPicker :model-value="pickerValue" :disabled="disabled" embedded
          @preview="draftValue = $event" @update:model-value="commitValue" />
      </span>
    </template>
    <OcFieldInput as="input" variant="plain" full-width :value="draftValue" :disabled="disabled"
      spellcheck="false" @input="handleTextInput" @blur="commitTextValue"
      @keydown.enter.prevent="commitTextValue" />
  </OcFieldFrame>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcColorPicker from './OcColorPicker.vue'
import { normalizeHexColor } from './colorModel'

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
  commit: [value: string]
}>()

defineOptions({ name: 'OcColorField' })

const draftValue = ref(props.modelValue)
const pickerValue = computed(() => normalizeHexColor(draftValue.value) ?? '#000000')
const invalidDraft = computed(() => Boolean(draftValue.value && !normalizeHexColor(draftValue.value)))

watch(() => props.modelValue, value => {
  draftValue.value = value
})

function handleTextInput(event: Event): void {
  const target = event.target
  if (target instanceof HTMLInputElement) draftValue.value = target.value
}

function commitTextValue(): void {
  const normalized = normalizeHexColor(draftValue.value)
  if (normalized) commitValue(normalized)
}

function commitValue(value: string): void {
  draftValue.value = value
  emit('update:modelValue', value)
  emit('commit', value)
}
</script>

<style scoped>
.oc-color-field__swatch {
  display: inline-flex;
  width: calc(var(--oc-size-md) - 2px);
  border-right: 1px solid var(--oc-border-muted);
  box-sizing: border-box;
}

.oc-color-field__swatch :deep(.oc-color-picker) {
  width: 100%;
}

.oc-color-field :deep(.oc-field-input) {
  height: 100%;
  min-height: 0;
  padding: var(--oc-field-content-padding, var(--oc-space-1) var(--oc-space-2));
}

.oc-color-field :deep(.oc-field-input:focus),
.oc-color-field :deep(.oc-field-input:focus-visible) {
  border-color: transparent;
}
</style>
