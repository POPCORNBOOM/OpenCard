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
    'is-chromed': props.chromed,
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

.oc-field-core.is-chromed {
  background: var(--oc-bg-input);
  border: 1px solid var(--oc-border-input);
  color: var(--oc-text-primary);
  padding: 2px 6px;
}

.oc-field-core.is-chromed:focus,
.oc-field-core.is-chromed:focus-visible {
  border-color: var(--oc-accent);
  outline: none;
}
</style>
