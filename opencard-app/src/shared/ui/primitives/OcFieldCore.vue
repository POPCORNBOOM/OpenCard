<template>
  <component
    :is="as"
    class="oc-field-core"
    :class="fieldClass"
    :style="fieldStyle"
    v-bind="attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs, type CSSProperties, type HTMLAttributes } from 'vue'

defineOptions({
  name: 'OcFieldCore',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: 'input' | 'select' | 'textarea'
  inputClass?: HTMLAttributes['class']
  chromed?: boolean
  fullWidth?: boolean
  monospace?: boolean
  padding?: string
  resize?: 'none' | 'horizontal' | 'vertical' | 'both'
}>(), {
  as: 'input',
  inputClass: undefined,
  chromed: true,
  fullWidth: false,
  monospace: false,
  padding: undefined,
  resize: undefined,
})

const attrs = useAttrs()

const fieldClass = computed(() => [
  props.inputClass,
  {
    'is-chromed': props.chromed,
    'is-full-width': props.fullWidth,
    'is-monospace': props.monospace,
  },
])

const fieldStyle = computed<CSSProperties>(() => ({
  ...(props.padding ? { '--oc-field-core-padding': props.padding } : {}),
  ...(props.resize && props.as === 'textarea' ? { resize: props.resize } : {}),
}))
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
  padding: var(--oc-field-core-padding, 2px 6px);
}

.oc-field-core.is-full-width {
  width: 100%;
  box-sizing: border-box;
}

.oc-field-core.is-monospace {
  font-family: Consolas, 'Courier New', monospace;
}

.oc-field-core.is-chromed:focus,
.oc-field-core.is-chromed:focus-visible {
  border-color: var(--oc-accent);
  outline: none;
}
</style>
