<!-- 静态表面原语：只负责背景、边框、圆角、阴影与图案渲染，不承载交互状态。 -->
<template>
  <component :is="as" class="oc-surface" :class="surfaceClass" :style="forwardedStyle" v-bind="forwardedAttrs">
    <div class="oc-surface__content">
      <slot />
    </div>
  </component>
</template>

<script lang="ts">
import type { ExtractPropTypes, PropType } from 'vue'

export const OC_SURFACE_TONES = [
  'base',
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

export const OC_SURFACE_RADII = [
  'none',
  'sm',
  'md',
  'lg',
] as const

export const OC_SURFACE_ELEVATIONS = [
  'none',
  'sm',
  'md',
  'overlay',
] as const

export const OC_SURFACE_PATTERNS = [
  'none',
  'dot-grid',
  'checker-preview',
] as const

export const OC_SURFACE_BORDERS = [
  'none',
  'strong',
  'overlay',
  'accent',
] as const

export const OC_SURFACE_PADDINGS = [
  'none',
  'compact',
  'standard',
] as const

export type OcSurfaceTone = (typeof OC_SURFACE_TONES)[number]
export type OcSurfaceRadius = (typeof OC_SURFACE_RADII)[number]
export type OcSurfaceElevation = (typeof OC_SURFACE_ELEVATIONS)[number]
export type OcSurfacePattern = (typeof OC_SURFACE_PATTERNS)[number]
export type OcSurfaceBorder = (typeof OC_SURFACE_BORDERS)[number]
export type OcSurfacePadding = (typeof OC_SURFACE_PADDINGS)[number]

export const ocSurfaceProps = {
  /** 根元素标签。 */
  as: {
    type: String,
    default: 'div',
  },
  /** 表面底色语义。 */
  tone: {
    type: String as PropType<OcSurfaceTone>,
    default: 'panel',
  },
  /** 表面圆角 token。 */
  radius: {
    type: String as PropType<OcSurfaceRadius>,
    default: 'sm',
  },
  /** 表面阴影层级 token。 */
  elevation: {
    type: String as PropType<OcSurfaceElevation>,
    default: 'none',
  },
  /** 表面边框语义。 */
  border: {
    type: String as PropType<OcSurfaceBorder>,
    default: 'overlay',
  },
  /** 表面图案语义。 */
  pattern: {
    type: String as PropType<OcSurfacePattern>,
    default: 'none',
  },
  /** 表面内边距 token。 */
  padding: {
    type: String as PropType<OcSurfacePadding>,
    default: 'standard',
  },
  /** 是否铺满父容器。 */
  fill: {
    type: Boolean,
    default: false,
  },
  /** 是否裁切超出圆角边界的内容。 */
  clip: {
    type: Boolean,
    default: false,
  },
} as const

export type OcSurfaceProps = Readonly<ExtractPropTypes<typeof ocSurfaceProps>>
</script>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({
  name: 'OcSurface',
  inheritAttrs: false,
})

const props = defineProps(ocSurfaceProps)

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
  `oc-surface--padding-${props.padding}`,
  {
    'is-fill': props.fill,
    'is-clip': props.clip,
  },
])
</script>

<style scoped>
.oc-surface {
  overflow: visible;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  --oc-surface-bg: transparent;
  --oc-surface-border: transparent;
  border: var(--oc-thickness-1) solid var(--oc-surface-border);
  background: var(--oc-surface-bg);
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-surface__content {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: inherit;
  flex-direction: inherit;
  justify-content: inherit;
  align-items: inherit;
  gap: inherit;
  flex: 1 1 auto;
  overflow: visible;
}

.oc-surface.is-fill {
  width: 100%;
  height: 100%;
}

.oc-surface.is-fill>.oc-surface__content {
  width: 100%;
  height: 100%;
}

.oc-surface.is-clip>.oc-surface__content {
  overflow: hidden;
  overflow: clip;
}

.oc-surface--tone-panel {
  --oc-surface-bg: var(--oc-bg-panel);
}

.oc-surface--tone-base {
  --oc-surface-bg: var(--oc-bg-base);
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
  --oc-surface-bg: var(--oc-bg-glass);
  -webkit-backdrop-filter: blur(var(--oc-blur-glass)) saturate(var(--oc-saturate-glass));
  backdrop-filter: blur(var(--oc-blur-glass)) saturate(var(--oc-saturate-glass));
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

.oc-surface--border-strong {
  --oc-surface-border: var(--oc-border-strong);
}

.oc-surface--border-overlay {
  --oc-surface-border: var(--oc-border-overlay-soft);
}

.oc-surface--border-accent {
  --oc-surface-border: var(--oc-bg-accent);
}

.oc-surface--radius-none,
.oc-surface--radius-none>.oc-surface__content {
  border-radius: 0;
}

.oc-surface--radius-sm,
.oc-surface--radius-sm>.oc-surface__content {
  border-radius: var(--oc-radius-sm);
}

.oc-surface--radius-md,
.oc-surface--radius-md>.oc-surface__content {
  border-radius: var(--oc-radius-md);
}

.oc-surface--radius-lg,
.oc-surface--radius-lg>.oc-surface__content {
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

.oc-surface--padding-none {
  padding: var(--oc-padding-none);
}

.oc-surface--padding-compact {
  padding: var(--oc-padding-compact);
}

.oc-surface--padding-standard {
  padding: var(--oc-padding-standard);
}
</style>
