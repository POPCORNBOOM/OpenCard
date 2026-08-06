<template>
  <OcFieldFrame full-width readonly :disabled="disabled">
    <template #prefix>
      <OcButton type="button" icon-only variant="ghost" icon="nav.arrow-left"
        :disabled="disabled || currentIndex <= 0" :aria-label="previousLabel" @click="step(-1)" />
    </template>
    <OcFieldInput variant="plain" full-width readonly :value="currentOption?.label ?? ''"
      @keydown.left.prevent="step(-1)" @keydown.right.prevent="step(1)" />
    <template #suffix>
      <OcButton type="button" icon-only variant="ghost" icon="nav.arrow-right"
        :disabled="disabled || currentIndex < 0 || currentIndex >= options.length - 1"
        :aria-label="nextLabel" @click="step(1)" />
    </template>
  </OcFieldFrame>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from '../base/OcButton.vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'

export type OcEnumStepperOption = {
  value: string
  label: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: readonly OcEnumStepperOption[]
  disabled?: boolean
  previousLabel?: string
  nextLabel?: string
}>(), {
  disabled: false,
  previousLabel: 'Previous option',
  nextLabel: 'Next option',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const currentIndex = computed(() => props.options.findIndex(option => option.value === props.modelValue))
const currentOption = computed(() => props.options[currentIndex.value])

function step(direction: -1 | 1): void {
  if (props.disabled) return
  const option = props.options[currentIndex.value + direction]
  if (option) emit('update:modelValue', option.value)
}
</script>
