<template>
  <component
    :is="as"
    class="oc-field-core"
    :class="fieldClass"
    v-bind="attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs, type HTMLAttributes } from 'vue'

defineOptions({
  name: 'OcFieldCore',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: 'input' | 'select' | 'textarea'
  inputClass?: HTMLAttributes['class']
  chromed?: boolean
}>(), {
  as: 'input',
  inputClass: undefined,
  chromed: true,
})

const attrs = useAttrs()

const fieldClass = computed(() => [
  props.inputClass,
  {
    'oc-input': props.chromed,
  },
])
</script>

<style scoped>
.oc-field-core {
  min-width: 0;
  font-family: var(--oc-font-family-ui);
  font-size: var(--oc-body-size);
  line-height: 1.4;
}

.oc-field-core.oc-input:focus {
  border-color: var(--oc-accent);
  outline: none;
}
</style>
