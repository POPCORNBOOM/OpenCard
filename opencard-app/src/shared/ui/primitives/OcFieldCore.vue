<template>
  <component
    :is="as"
    class="oc-field-core"
    :class="fieldClass"
    v-bind="forwardedAttrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'
import {
  useOcFieldCoreCapabilities,
  type OcFieldCoreDensity,
  type OcFieldCoreResize,
  type OcFieldCoreSize,
  type OcFieldCoreVariant,
} from '../composables/useOcFieldCoreCapabilities'
import { useOcForwardAttrs } from '../composables/useOcCapabilityClasses'

defineOptions({
  name: 'OcFieldCore',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
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
const forwardedAttrs = useOcForwardAttrs(attrs)
const { fieldClass } = useOcFieldCoreCapabilities({
  as: props.as,
  variant: props.variant,
  fullWidth: props.fullWidth,
  monospace: props.monospace,
  size: props.size,
  density: props.density,
  resize: props.resize,
})
</script>

<style scoped>
.oc-field-core {
  min-width: 0;
  box-sizing: border-box;
  font-family: var(--oc-font-family-ui);
  line-height: 1.4;
  --oc-field-core-padding-block: 2px;
  --oc-field-core-padding-inline: 6px;
}

.oc-field-core--variant-chromed {
  background: var(--oc-bg-input);
  border: 1px solid var(--oc-border-input);
  color: var(--oc-text-primary);
  padding: var(--oc-field-core-padding-block) var(--oc-field-core-padding-inline);
}

.oc-field-core--variant-plain {
  background: transparent;
  border: 1px solid transparent;
  color: var(--oc-text-primary);
}

.oc-field-core--width-auto {
  width: auto;
}

.oc-field-core--width-full {
  width: 100%;
}

.oc-field-core--font-ui {
  font-family: var(--oc-font-family-ui);
}

.oc-field-core--font-mono {
  font-family: Consolas, 'Courier New', monospace;
}

.oc-field-core--size-sm {
  font-size: 11px;
}

.oc-field-core--size-md {
  font-size: var(--oc-body-size);
}

.oc-field-core--size-lg {
  font-size: 13px;
}

.oc-field-core--density-compact {
  --oc-field-core-padding-block: 1px;
  --oc-field-core-padding-inline: 4px;
}

.oc-field-core--density-comfortable {
  --oc-field-core-padding-block: 2px;
  --oc-field-core-padding-inline: 6px;
}

.oc-field-core--density-spacious {
  --oc-field-core-padding-block: 5px;
  --oc-field-core-padding-inline: 8px;
}

.oc-field-core--resize-none {
  resize: none;
}

.oc-field-core--resize-horizontal {
  resize: horizontal;
}

.oc-field-core--resize-vertical {
  resize: vertical;
}

.oc-field-core--resize-both {
  resize: both;
}

.oc-field-core--variant-chromed:focus,
.oc-field-core--variant-chromed:focus-visible {
  border-color: var(--oc-accent);
  outline: none;
}
</style>
