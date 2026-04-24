<template>
  <component :is="as" class="oc-surface" :class="surfaceClass" :style="forwardedStyle" v-bind="forwardedAttrs">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import {
  useOcSurfaceCapabilities,
  type OcSurfacePattern,
  type OcSurfaceRadius,
  type OcSurfaceShadow,
  type OcSurfaceVariant,
} from '../composables/useOcSurfaceCapabilities'
import { useOcForwardAttrs } from '../composables/useOcCapabilityClasses'

defineOptions({
  name: 'OcSurface',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: string
  variant?: OcSurfaceVariant
  radius?: OcSurfaceRadius
  shadow?: OcSurfaceShadow
  bordered?: boolean
  fill?: boolean
  pattern?: OcSurfacePattern
}>(), {
  as: 'div',
  variant: 'panel',
  radius: 'sm',
  shadow: 'none',
  bordered: false,
  fill: false,
  pattern: 'none',
})

const attrs = useAttrs()
const forwardedAttrs = useOcForwardAttrs(attrs)
const forwardedStyle = computed(() => attrs.style)
const { surfaceClass } = useOcSurfaceCapabilities({
  variant: () => props.variant,
  radius: () => props.radius,
  shadow: () => props.shadow,
  pattern: () => props.pattern,
  bordered: () => props.bordered,
  fill: () => props.fill,
})
</script>

<style scoped>
.oc-surface {
  min-width: 0;
  min-height: 0;
}

.oc-surface.is-fill {
  width: 100%;
  height: 100%;
}

.oc-surface--panel {
  background: var(--oc-bg-panel);
}

.oc-surface--elevated {
  background: var(--oc-bg-elevated);
}

.oc-surface--input {
  background: var(--oc-bg-input);
}

.oc-surface--floating {
  background: var(--oc-bg-panel);
}

.oc-surface--transparent {
  background: transparent;
}

.oc-surface--glass {
  background: var(--oc-bg-overlay-soft);
  backdrop-filter: blur(14px);
}

.oc-surface.is-bordered {
  border: 1px solid var(--oc-border-surface);
}

.oc-surface--radius-none {
  border-radius: 0;
}

.oc-surface--radius-sm {
  border-radius: var(--oc-radius-sm);
}

.oc-surface--radius-md {
  border-radius: var(--oc-radius-md);
}

.oc-surface--radius-lg {
  border-radius: var(--oc-radius-lg);
}

.oc-surface--shadow-none {
  box-shadow: none;
}

.oc-surface--shadow-sm {
  box-shadow: var(--oc-shadow-sm);
}

.oc-surface--shadow-md {
  box-shadow: var(--oc-shadow-md);
}

.oc-surface--shadow-overlay {
  box-shadow: var(--oc-shadow-overlay);
}

.oc-surface--pattern-none {
  /* empty */
}

.oc-surface--pattern-dot-grid {
  background-color: var(--oc-bg-elevated);
  background-image: radial-gradient(circle at 1px 1px, var(--oc-border-subtle) 1px, transparent 0);
  background-size: 22px 22px;
}

.oc-surface--pattern-checker-preview {
  background:
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
  outline: 1px solid var(--oc-border-overlay-faint);
}
</style>
