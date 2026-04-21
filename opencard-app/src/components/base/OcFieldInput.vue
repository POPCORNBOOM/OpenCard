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
import { ref, useAttrs, type HTMLAttributes } from 'vue'
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
const fieldRef = ref<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>(null)

defineExpose({
  focus() {
    fieldRef.value?.focus()
  },
  blur() {
    fieldRef.value?.blur()
  },
})
</script>

<style scoped>
.oc-field-input {
  padding: 2px 6px;
}
</style>
