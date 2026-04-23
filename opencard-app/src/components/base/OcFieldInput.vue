<template>
  <OcFieldCore
    ref="fieldRef"
    :as="as"
    class="oc-field-input"
    :variant="variant"
    :full-width="fullWidth"
    :monospace="monospace"
    :size="size"
    :density="density"
    :resize="resize"
    v-bind="attrs"
  >
    <slot />
  </OcFieldCore>
</template>

<script setup lang="ts">
import { ref, useAttrs, type ComponentPublicInstance } from 'vue'
import { OcFieldCore } from '../../shared/ui/primitives'
import {
  type OcFieldCoreDensity,
  type OcFieldCoreResize,
  type OcFieldCoreSize,
  type OcFieldCoreVariant,
} from '../../shared/ui/composables/useOcFieldCoreCapabilities'

defineOptions({
  name: 'OcFieldInput',
  inheritAttrs: false,
})

withDefaults(defineProps<{
  as?: 'input' | 'select' | 'textarea'
  variant?: OcFieldCoreVariant
  fullWidth?: boolean
  monospace?: boolean
  size?: OcFieldCoreSize
  density?: OcFieldCoreDensity
  resize?: OcFieldCoreResize
}>(), {
  as: 'input',
  variant: 'chromed',
  fullWidth: false,
  monospace: false,
  size: 'md',
  density: 'comfortable',
  resize: 'none',
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
