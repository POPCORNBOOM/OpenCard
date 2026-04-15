<template>
  <component
    :is="as"
    class="oc-field-input oc-input"
    :class="inputClass"
    v-bind="attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { useAttrs, type HTMLAttributes } from 'vue'

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
</script>

<style scoped>
.oc-field-input {
  padding: 2px 6px;
}

.oc-field-input:focus {
  border-color: var(--oc-accent);
}
</style>
