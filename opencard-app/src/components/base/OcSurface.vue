<!-- 静态表面原语：只负责背景、边框、圆角、阴影与图案渲染，不承载交互状态。 -->
<template>
  <component :is="as" class="oc-surface" :class="surfaceClass" :style="forwardedStyle" v-bind="forwardedAttrs">
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

const OC_SURFACE_TONES = [
  'panel',
  'elevated',
  'input',
  'floating',
  'transparent',
  'glass',
  'accent',
  'accent-hover',
  'hover',
  'active',
] as const

const OC_SURFACE_RADII = [
  'none',
  'sm',
  'md',
  'lg',
] as const

const OC_SURFACE_ELEVATIONS = [
  'none',
  'sm',
  'md',
  'overlay',
] as const

const OC_SURFACE_PATTERNS = [
  'none',
  'dot-grid',
  'checker-preview',
] as const

type OcSurfaceTone = (typeof OC_SURFACE_TONES)[number]
type OcSurfaceRadius = (typeof OC_SURFACE_RADII)[number]
type OcSurfaceElevation = (typeof OC_SURFACE_ELEVATIONS)[number]
type OcSurfacePattern = (typeof OC_SURFACE_PATTERNS)[number]
type OcSurfaceBorder = 'none' | 'subtle' | 'strong' | 'overlay' | 'accent'

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
const forwardedAttrs = computed(() => {
  const {
    style: _style,
    variant: _variant,
    shadow: _shadow,
    bordered: _bordered,
    ...restAttrs
  } = attrs as Record<string, unknown>

  return restAttrs
})
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
  --oc-surface-bg: transparent;
  --oc-surface-border: transparent;
  border: var(--oc-thickness-1) solid var(--oc-surface-border);
  background: var(--oc-surface-bg);
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-surface.is-fill {
  width: 100%;
  height: 100%;
}

.oc-surface--tone-panel {
  --oc-surface-bg: var(--oc-bg-panel);
}

.oc-surface--tone-elevated {
  --oc-surface-bg: var(--oc-bg-elevated);
}

.oc-surface--tone-input {
  --oc-surface-bg: var(--oc-bg-input);
}

.oc-surface--tone-floating {
  --oc-surface-bg: var(--oc-bg-panel);
}

.oc-surface--tone-transparent {
  --oc-surface-bg: transparent;
}

.oc-surface--tone-glass {
  --oc-surface-bg: var(--oc-bg-overlay-soft);
  backdrop-filter: blur(14px);
}

.oc-surface--tone-accent {
  --oc-surface-bg: var(--oc-bg-accent);
}

.oc-surface--tone-accent-hover {
  --oc-surface-bg: var(--oc-bg-accent-hover);
}

.oc-surface--tone-hover {
  --oc-surface-bg: var(--oc-bg-hover);
}

.oc-surface--tone-active {
  --oc-surface-bg: var(--oc-bg-active);
}

.oc-surface--border-none {
  --oc-surface-border: transparent;
}

.oc-surface--border-subtle {
  --oc-surface-border: var(--oc-border-surface);
}

.oc-surface--border-strong {
  --oc-surface-border: var(--oc-border-strong);
}

.oc-surface--border-overlay {
  --oc-surface-border: var(--oc-border-overlay-soft);
}

.oc-surface--border-accent {
  --oc-surface-border: var(--oc-bg-accent);
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
  background-color: var(--oc-surface-bg);
  background-image: radial-gradient(circle at 1px 1px, var(--oc-border-subtle) 1px, transparent 0);
  background-size: 22px 22px;
}

.oc-surface--pattern-checker-preview {
  background-color: var(--oc-surface-bg);
  background-image:
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
  outline: 1px solid var(--oc-border-overlay-faint);
}
</style>
