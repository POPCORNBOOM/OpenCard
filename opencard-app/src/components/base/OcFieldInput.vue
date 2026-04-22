<template>
  <OcFieldCore
    ref="fieldRef"
    :as="as"
    class="oc-field-input"
    :input-class="inputClass"
    v-bind="attrs"
  >
    <slot />
  </OcFieldCore>
</template>

<script setup lang="ts">
import { ref, useAttrs, type ComponentPublicInstance, type HTMLAttributes } from 'vue'
import { OcFieldCore } from '../../shared/ui/primitives'

defineOptions({
  name: 'OcFieldInput',
  inheritAttrs: false,
})

withDefaults(defineProps<{
  as?: 'input' | 'select' | 'textarea'
  inputClass?: HTMLAttributes['class']
}>(), {
  as: 'input',
  inputClass: undefined,
})

const attrs = useAttrs()
const fieldRef = ref<
  | HTMLInputElement
  | HTMLTextAreaElement
  | HTMLSelectElement
  | ComponentPublicInstance
  | null
>(null)

function resolveNativeField() {
  const current = fieldRef.value
  if (!current) {
    return null
  }

  if (current instanceof HTMLInputElement || current instanceof HTMLTextAreaElement || current instanceof HTMLSelectElement) {
    return current
  }

  const element = (current as ComponentPublicInstance).$el
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return element
  }

  return null
}

defineExpose({
  focus() {
    resolveNativeField()?.focus()
  },
  blur() {
    resolveNativeField()?.blur()
  },
})
</script>
