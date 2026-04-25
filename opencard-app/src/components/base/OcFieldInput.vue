<!-- Base 字段输入组件：独立实现字段几何与视觉变体，不依赖 shared primitives。 -->
<template>
  <component
    :is="as"
    ref="fieldRef"
    class="oc-field-input"
    :class="fieldClass"
    v-bind="attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, type ComponentPublicInstance } from 'vue'
import {
  type OcFieldCoreDensity,
  type OcFieldCoreResize,
  type OcFieldCoreSize,
  type OcFieldCoreVariant,
} from '../../shared/ui/composables/useOcFieldCoreCapabilities'

interface OcFieldInputProps {
  /** 根元素标签，仅允许原生表单元素。 */
  as?: 'input' | 'select' | 'textarea'
  /** 字段视觉变体。 */
  variant?: OcFieldCoreVariant
  /** 是否占满可用宽度。 */
  fullWidth?: boolean
  /** 是否切换为等宽字体。 */
  monospace?: boolean
  /** 字段字号 token。 */
  size?: OcFieldCoreSize
  /** 内边距密度 token。 */
  density?: OcFieldCoreDensity
  /** resize 行为 token（主要作用于 textarea）。 */
  resize?: OcFieldCoreResize
}

defineOptions({
  name: 'OcFieldInput',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcFieldInputProps>(), {
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

const fieldClass = computed(() => [
  `oc-field-input--variant-${props.variant}`,
  `oc-field-input--size-${props.size}`,
  `oc-field-input--density-${props.density}`,
  `oc-field-input--resize-${props.resize}`,
  {
    'oc-field-input--width-full': props.fullWidth,
    'oc-field-input--width-auto': !props.fullWidth,
    'oc-field-input--font-mono': props.monospace,
    'oc-field-input--font-ui': !props.monospace,
  },
])

function resolveNativeField() {
  const current = fieldRef.value
  if (!current) {
    return null
  }

  if (
    current instanceof HTMLInputElement
    || current instanceof HTMLTextAreaElement
    || current instanceof HTMLSelectElement
  ) {
    return current
  }

  const element = (current as ComponentPublicInstance).$el
  if (
    element instanceof HTMLInputElement
    || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement
  ) {
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

<style scoped>
.oc-field-input {
  min-width: 0;
  box-sizing: border-box;
  line-height: 1.4;
  --oc-field-input-padding-block: 2px;
  --oc-field-input-padding-inline: 6px;
}

.oc-field-input--variant-chromed {
  background: var(--oc-bg-input);
  border: 1px solid var(--oc-border-input);
  color: var(--oc-text-primary);
  padding: var(--oc-field-input-padding-block) var(--oc-field-input-padding-inline);
}

.oc-field-input--variant-plain {
  background: transparent;
  border: 1px solid transparent;
  color: var(--oc-text-primary);
}

.oc-field-input--width-auto {
  width: auto;
}

.oc-field-input--width-full {
  width: 100%;
}

.oc-field-input--font-ui {
  font-family: var(--oc-font-family-ui);
}

.oc-field-input--font-mono {
  font-family: Consolas, 'Courier New', monospace;
}

.oc-field-input--size-sm {
  font-size: 11px;
}

.oc-field-input--size-md {
  font-size: var(--oc-body-size);
}

.oc-field-input--size-lg {
  font-size: 13px;
}

.oc-field-input--density-compact {
  --oc-field-input-padding-block: 1px;
  --oc-field-input-padding-inline: 4px;
}

.oc-field-input--density-comfortable {
  --oc-field-input-padding-block: 2px;
  --oc-field-input-padding-inline: 6px;
}

.oc-field-input--density-spacious {
  --oc-field-input-padding-block: 5px;
  --oc-field-input-padding-inline: 8px;
}

.oc-field-input--resize-none {
  resize: none;
}

.oc-field-input--resize-horizontal {
  resize: horizontal;
}

.oc-field-input--resize-vertical {
  resize: vertical;
}

.oc-field-input--resize-both {
  resize: both;
}

.oc-field-input--variant-chromed:focus,
.oc-field-input--variant-chromed:focus-visible {
  border-color: var(--oc-accent);
  outline: none;
}
</style>
