<!-- 表面样式原语：只负责背景、边框、圆角、阴影和图案，不承担交互语义。 -->
<template>
  <component :is="as" class="oc-surface" :class="surfaceClass" :style="forwardedStyle" v-bind="forwardedAttrs">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useOcForwardAttrs } from '../composables/useOcCapabilityClasses'
import {
  OC_SURFACE_PATTERNS,
  OC_SURFACE_RADII,
  OC_SURFACE_SHADOWS,
  OC_SURFACE_VARIANTS,
} from '../foundation/tokenRegistry'

type OcSurfaceTone = (typeof OC_SURFACE_VARIANTS)[number]
type OcSurfaceRadius = (typeof OC_SURFACE_RADII)[number]
type OcSurfaceElevation = (typeof OC_SURFACE_SHADOWS)[number]
type OcSurfacePattern = (typeof OC_SURFACE_PATTERNS)[number]
type OcSurfaceBorder = 'none' | 'subtle' | 'strong' | 'overlay'

interface OcSurfaceProps {
  /** 根元素标签。 */
  as?: string
  /** 表面底色语义。 */
  tone?: OcSurfaceTone
  /** 表面圆角 token。 */
  radius?: OcSurfaceRadius
  /** 表面阴影层级 token。 */
  elevation?: OcSurfaceElevation
  /** 表面边框语义。 */
  border?: OcSurfaceBorder
  /** 表面图案语义。 */
  pattern?: OcSurfacePattern
  /** 是否铺满父容器。 */
  fill?: boolean
}

defineOptions({
  name: 'OcSurface',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcSurfaceProps>(), {
  as: 'div',
  tone: 'panel',
  radius: 'sm',
  elevation: 'none',
  border: 'none',
  pattern: 'none',
  fill: false,
})

const attrs = useAttrs()
const forwardedAttrs = useOcForwardAttrs(attrs, ['style', 'variant', 'shadow', 'bordered'])
const forwardedStyle = computed(() => attrs.style)

const surfaceClass = computed(() => [
  `oc-surface--tone-${props.tone}`,
  `oc-surface--radius-${props.radius}`,
  `oc-surface--elevation-${props.elevation}`,
  `oc-surface--border-${props.border}`,
  `oc-surface--pattern-${props.pattern}`,
  {
    'is-fill': props.fill,
  },
])
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

.oc-surface--tone-panel {
  background: var(--oc-bg-panel);
}

.oc-surface--tone-elevated {
  background: var(--oc-bg-elevated);
}

.oc-surface--tone-input {
  background: var(--oc-bg-input);
}

.oc-surface--tone-floating {
  background: var(--oc-bg-panel);
}

.oc-surface--tone-transparent {
  background: transparent;
}

.oc-surface--tone-glass {
  background: var(--oc-bg-overlay-soft);
  backdrop-filter: blur(14px);
}

.oc-surface--border-none {
  border: 1px solid transparent;
}

.oc-surface--border-subtle {
  border: 1px solid var(--oc-border-surface);
}

.oc-surface--border-strong {
  border: 1px solid var(--oc-border-strong);
}

.oc-surface--border-overlay {
  border: 1px solid var(--oc-border-overlay-soft);
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

.oc-surface--elevation-none {
  box-shadow: none;
}

.oc-surface--elevation-sm {
  box-shadow: var(--oc-shadow-sm);
}

.oc-surface--elevation-md {
  box-shadow: var(--oc-shadow-md);
}

.oc-surface--elevation-overlay {
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
