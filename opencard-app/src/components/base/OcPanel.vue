<!-- Base 统一面板容器：合并表面渲染、布局语义与双轴溢出策略。 -->
<template>
  <component :is="as" class="oc-panel" :class="panelClass" :style="panelStyle" v-bind="forwardedAttrs">
    <slot />
  </component>
</template>

<script lang="ts">
import type { ExtractPropTypes, PropType } from 'vue'
import {
  OC_BOX_DIMENSION_TOKENS,
  OC_GAP_TOKENS,
  OC_SURFACE_RADII,
  OC_SURFACE_SHADOWS,
  OC_SURFACE_VARIANTS,
} from '../../shared/ui/foundation/tokenRegistry'

export const OC_PANEL_ORIENTATIONS = ['horizontal', 'vertical'] as const
export const OC_PANEL_POSITIONS = ['static', 'relative', 'absolute'] as const
export const OC_PANEL_ANCHORS = ['none', 'cover', 'origin'] as const
export const OC_PANEL_ALIGNMENTS = ['start', 'center', 'end', 'stretch'] as const
export const OC_PANEL_INTERACTIONS = ['auto', 'passthrough'] as const
export const OC_PANEL_BORDERS = ['none', 'transparent', 'black', 'soft', 'accent'] as const
export const OC_PANEL_BACKGROUNDS = ['none', 'tri-dot', 'squ-dot', 'checker'] as const
export const OC_PANEL_PADDINGS = ['none', 'compact', 'standard'] as const
export const OC_PANEL_OVERFLOW_VALUES = ['visible', 'clip', 'auto', 'scroll'] as const

export type OcPanelDimension = (typeof OC_BOX_DIMENSION_TOKENS)[number]
export type OcPanelGap = (typeof OC_GAP_TOKENS)[number]
export type OcPanelTone = (typeof OC_SURFACE_VARIANTS)[number]
export type OcPanelRadius = (typeof OC_SURFACE_RADII)[number]
export type OcPanelElevation = (typeof OC_SURFACE_SHADOWS)[number]
export type OcPanelOrientation = (typeof OC_PANEL_ORIENTATIONS)[number]
export type OcPanelPosition = (typeof OC_PANEL_POSITIONS)[number]
export type OcPanelAnchor = (typeof OC_PANEL_ANCHORS)[number]
export type OcPanelAlignment = (typeof OC_PANEL_ALIGNMENTS)[number]
export type OcPanelInteraction = (typeof OC_PANEL_INTERACTIONS)[number]
export type OcPanelBorder = (typeof OC_PANEL_BORDERS)[number]
export type OcPanelBackground = (typeof OC_PANEL_BACKGROUNDS)[number]
export type OcPanelPadding = (typeof OC_PANEL_PADDINGS)[number]
export type OcPanelOverflow = (typeof OC_PANEL_OVERFLOW_VALUES)[number]

export const ocPanelProps = {
  /** 根元素标签。 */
  as: {
    type: String,
    default: 'div',
  },
  /** 是否占满父容器尺寸。 */
  fill: {
    type: Boolean,
    default: false,
  },
  /** 是否在父 flex 容器中吃满剩余空间。 */
  grow: {
    type: Boolean,
    default: false,
  },
  /** 子项间距语义。 */
  gap: {
    type: String as PropType<OcPanelGap>,
    default: 'none',
  },
  /** 主布局方向。 */
  orientation: {
    type: String as PropType<OcPanelOrientation>,
    default: 'vertical',
  },
  /** 定位模式。 */
  position: {
    type: String as PropType<OcPanelPosition>,
    default: 'static',
  },
  /** 外部锚点（组件本体定位）。 */
  anchor: {
    type: String as PropType<OcPanelAnchor>,
    default: 'none',
  },
  /** 水平对齐语义（组件内容排布）。 */
  horizontalAlignment: {
    type: String as PropType<OcPanelAlignment>,
    default: 'stretch',
  },
  /** 垂直对齐语义（组件内容排布）。 */
  verticalAlignment: {
    type: String as PropType<OcPanelAlignment>,
    default: 'start',
  },
  /** 指针交互策略。 */
  interaction: {
    type: String as PropType<OcPanelInteraction>,
    default: 'auto',
  },
  /** 宽度语义。 */
  width: {
    type: String as PropType<OcPanelDimension>,
    default: 'auto',
  },
  /** 高度语义。 */
  height: {
    type: String as PropType<OcPanelDimension>,
    default: 'auto',
  },
  /** 最小宽度语义。 */
  minWidth: {
    type: String as PropType<OcPanelDimension | undefined>,
    default: undefined,
  },
  /** 最大宽度语义。 */
  maxWidth: {
    type: String as PropType<OcPanelDimension | undefined>,
    default: undefined,
  },
  /** 最小高度语义。 */
  minHeight: {
    type: String as PropType<OcPanelDimension | undefined>,
    default: undefined,
  },
  /** 最大高度语义。 */
  maxHeight: {
    type: String as PropType<OcPanelDimension | undefined>,
    default: undefined,
  },
  /** 背景语义。 */
  tone: {
    type: String as PropType<OcPanelTone>,
    default: 'panel',
  },
  /** 圆角语义。 */
  radius: {
    type: String as PropType<OcPanelRadius>,
    default: 'sm',
  },
  /** 阴影语义。 */
  elevation: {
    type: String as PropType<OcPanelElevation>,
    default: 'none',
  },
  /** 边框语义。 */
  border: {
    type: String as PropType<OcPanelBorder>,
    default: 'soft',
  },
  /** 背景图案语义。 */
  background: {
    type: String as PropType<OcPanelBackground>,
    default: 'none',
  },
  /** 是否启用悬停高亮。 */
  hoverable: {
    type: Boolean,
    default: false,
  },
  /** 内边距语义。 */
  padding: {
    type: String as PropType<OcPanelPadding>,
    default: 'standard',
  },
  /** X 轴溢出策略。 */
  overflowX: {
    type: String as PropType<OcPanelOverflow>,
    default: 'visible',
  },
  /** Y 轴溢出策略。 */
  overflowY: {
    type: String as PropType<OcPanelOverflow>,
    default: 'visible',
  },
} as const

export type OcPanelProps = Readonly<ExtractPropTypes<typeof ocPanelProps>>
</script>

<script setup lang="ts">
import { computed, useAttrs, watchEffect } from 'vue'
import type { CSSProperties } from 'vue'
import { resolveOcGapToken } from '../../shared/ui/foundation/tokenRegistry'

type FlexAxisAlignment = 'flex-start' | 'center' | 'flex-end' | 'stretch'

defineOptions({
  name: 'OcPanel',
  inheritAttrs: false,
})

const props = defineProps(ocPanelProps)

const attrs = useAttrs()
const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...restAttrs } = attrs
  return restAttrs
})

if (import.meta.env.DEV) {
  const hasExternalClass = computed(() => attrs.class !== undefined)
  const hasExternalStyle = computed(() => attrs.style !== undefined)

  watchEffect(() => {
    if (!hasExternalClass.value && !hasExternalStyle.value) {
      return
    }

    console.warn(
      '[OcPanel] External class/style attrs are ignored. Use semantic props instead.',
      {
        hasClass: hasExternalClass.value,
        hasStyle: hasExternalStyle.value,
      },
    )
  })
}

const effectiveAnchor = computed<OcPanelAnchor>(() =>
  props.position === 'static' ? 'none' : props.anchor,
)

function resolveAlignment(value: OcPanelAlignment): FlexAxisAlignment {
  if (value === 'center') {
    return 'center'
  }
  if (value === 'end') {
    return 'flex-end'
  }
  if (value === 'stretch') {
    return 'stretch'
  }
  return 'flex-start'
}

function resolveDimensionValue(value: OcPanelDimension | undefined, axis: 'width' | 'height'): string | undefined {
  if (!value) {
    return undefined
  }

  switch (value) {
    case 'auto':
      return 'auto'
    case 'content':
      return 'fit-content'
    case 'full':
      return '100%'
    case 'screen':
      return axis === 'width' ? '100vw' : '100vh'
    case 'size-xs':
      return '36px'
    case 'size-sm':
      return '48px'
    case 'size-md':
      return '72px'
    case 'size-lg':
      return '96px'
    case 'size-xl':
      return '120px'
    case 'size-2xl':
      return '160px'
  }
}

const panelStyle = computed<CSSProperties>(() => {
  const horizontal = resolveAlignment(props.horizontalAlignment)
  const vertical = resolveAlignment(props.verticalAlignment)

  const rawJustify = props.orientation === 'vertical' ? vertical : horizontal
  const align = props.orientation === 'vertical' ? horizontal : vertical
  const justify = rawJustify === 'stretch' ? 'flex-start' : rawJustify

  const minWidth = resolveDimensionValue(props.minWidth, 'width')
  const maxWidth = resolveDimensionValue(props.maxWidth, 'width')
  const minHeight = resolveDimensionValue(props.minHeight, 'height')
  const maxHeight = resolveDimensionValue(props.maxHeight, 'height')

  return {
    '--oc-panel-content-justify': justify,
    '--oc-panel-content-align': align,
    gap: resolveOcGapToken(props.gap),
    minWidth,
    maxWidth,
    minHeight,
    maxHeight,
    overflowX: props.overflowX,
    overflowY: props.overflowY,
  } as CSSProperties
})

const panelClass = computed(() => [
  `oc-panel--orientation-${props.orientation}`,
  `oc-panel--position-${props.position}`,
  `oc-panel--anchor-${effectiveAnchor.value}`,
  `oc-panel--interaction-${props.interaction}`,
  `oc-panel--width-${props.width}`,
  `oc-panel--height-${props.height}`,
  `oc-panel--tone-${props.tone}`,
  `oc-panel--radius-${props.radius}`,
  `oc-panel--elevation-${props.elevation}`,
  `oc-panel--border-${props.border}`,
  `oc-panel--background-${props.background}`,
  `oc-panel--padding-${props.padding}`,
  {
    'is-fill': props.fill,
    'is-grow': props.grow,
    'is-hoverable': props.hoverable,
    'is-main-axis-stretch':
      (props.orientation === 'horizontal' && props.horizontalAlignment === 'stretch') ||
      (props.orientation === 'vertical' && props.verticalAlignment === 'stretch'),
  },
])
</script>

<style scoped>
.oc-panel {
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: var(--oc-panel-content-justify, flex-start);
  align-items: var(--oc-panel-content-align, flex-start);
  --oc-panel-bg: transparent;
  --oc-panel-hover-bg: var(--oc-bg-hover);
  --oc-panel-hover-filter: brightness(1.08);
  --oc-panel-border: transparent;
  --oc-panel-elevation-shadow: none;
  border: var(--oc-thickness-1) solid var(--oc-panel-border);
  background: var(--oc-panel-bg);
  box-shadow: var(--oc-panel-elevation-shadow);
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    box-shadow var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-panel.is-hoverable:hover {
  box-shadow:
    var(--oc-panel-elevation-shadow),
    inset 0 0 0 9999px var(--oc-panel-hover-bg);
  filter: var(--oc-panel-hover-filter);
}

.oc-panel.is-main-axis-stretch> :deep(*) {
  flex: 1 1 auto;
}

.oc-panel.is-fill {
  width: 100%;
  height: 100%;
}

.oc-panel.is-grow {
  flex: 1 1 auto;
}

.oc-panel--orientation-horizontal {
  flex-direction: row;
}

.oc-panel--orientation-vertical {
  flex-direction: column;
}

.oc-panel--position-static {
  position: static;
}

.oc-panel--position-relative {
  position: relative;
}

.oc-panel--position-absolute {
  position: absolute;
}

.oc-panel--anchor-none {
  inset: auto;
}

.oc-panel--anchor-cover {
  inset: 0;
}

.oc-panel--anchor-origin {
  inset: 0 auto auto 0;
}

.oc-panel--interaction-auto {
  pointer-events: auto;
}

.oc-panel--interaction-passthrough {
  pointer-events: none;
}

.oc-panel--width-auto {
  width: auto;
}

.oc-panel--width-content {
  width: fit-content;
}

.oc-panel--width-full {
  width: 100%;
}

.oc-panel--width-screen {
  width: 100vw;
}

.oc-panel--width-size-xs {
  width: 36px;
}

.oc-panel--width-size-sm {
  width: 48px;
}

.oc-panel--width-size-md {
  width: 72px;
}

.oc-panel--width-size-lg {
  width: 96px;
}

.oc-panel--width-size-xl {
  width: 120px;
}

.oc-panel--width-size-2xl {
  width: 160px;
}

.oc-panel--height-auto {
  height: auto;
}

.oc-panel--height-content {
  height: fit-content;
}

.oc-panel--height-full {
  height: 100%;
}

.oc-panel--height-screen {
  height: 100vh;
}

.oc-panel--height-size-xs {
  height: 36px;
}

.oc-panel--height-size-sm {
  height: 48px;
}

.oc-panel--height-size-md {
  height: 72px;
}

.oc-panel--height-size-lg {
  height: 96px;
}

.oc-panel--height-size-xl {
  height: 120px;
}

.oc-panel--height-size-2xl {
  height: 160px;
}

.oc-panel--tone-panel {
  --oc-panel-bg: var(--oc-bg-panel);
}

.oc-panel--tone-base {
  --oc-panel-bg: var(--oc-bg-base);
}

.oc-panel--tone-elevated {
  --oc-panel-bg: var(--oc-bg-elevated);
}

.oc-panel--tone-input {
  --oc-panel-bg: var(--oc-bg-input);
}

.oc-panel--tone-transparent {
  --oc-panel-bg: transparent;
}

.oc-panel--tone-glass {
  --oc-panel-bg: var(--oc-bg-glass);
  -webkit-backdrop-filter: blur(var(--oc-blur-glass)) saturate(var(--oc-saturate-glass));
  backdrop-filter: blur(var(--oc-blur-glass)) saturate(var(--oc-saturate-glass));
}

.oc-panel--tone-accent {
  --oc-panel-bg: var(--oc-bg-accent);
  --oc-panel-hover-bg: var(--oc-bg-accent-hover);
  --oc-panel-hover-filter: brightness(1.12);
}

.oc-panel--tone-active {
  --oc-panel-bg: var(--oc-bg-active);
}

.oc-panel--border-none {
  border-width: 0;
  --oc-panel-border: transparent;
}

.oc-panel--border-transparent {
  --oc-panel-border: transparent;
}

.oc-panel--border-black {
  --oc-panel-border: var(--oc-border-strong);
}

.oc-panel--border-soft {
  --oc-panel-border: var(--oc-border-overlay-soft);
}

.oc-panel--border-accent {
  --oc-panel-border: var(--oc-bg-accent);
}

.oc-panel--radius-none {
  border-radius: 0;
}

.oc-panel--radius-sm {
  border-radius: var(--oc-radius-sm);
}

.oc-panel--radius-md {
  border-radius: var(--oc-radius-md);
}

.oc-panel--radius-lg {
  border-radius: var(--oc-radius-lg);
}

.oc-panel--elevation-none {
  --oc-panel-elevation-shadow: none;
}

.oc-panel--elevation-sm {
  --oc-panel-elevation-shadow: var(--oc-shadow-sm);
}

.oc-panel--elevation-md {
  --oc-panel-elevation-shadow: var(--oc-shadow-md);
}

.oc-panel--elevation-lg {
  --oc-panel-elevation-shadow: var(--oc-shadow-overlay);
}

.oc-panel--background-tri-dot {
  --oc-panel-tri-step: 16px;
  --oc-panel-tri-row: calc(var(--oc-panel-tri-step) * 0.8660254);
  --oc-panel-tri-dot-size: 1.2px;
  background-color: var(--oc-panel-bg);
  background-image:
    radial-gradient(circle at center,
      var(--oc-border-subtle) 0 var(--oc-panel-tri-dot-size),
      transparent calc(var(--oc-panel-tri-dot-size) + 0.1px)),
    radial-gradient(circle at center,
      var(--oc-border-subtle) 0 var(--oc-panel-tri-dot-size),
      transparent calc(var(--oc-panel-tri-dot-size) + 0.1px));
  background-size: var(--oc-panel-tri-step) var(--oc-panel-tri-row);
  background-position:
    0 0,
    calc(var(--oc-panel-tri-step) / 2) calc(var(--oc-panel-tri-row) / 2);
}

.oc-panel--background-squ-dot {
  background-color: var(--oc-panel-bg);
  background-image: radial-gradient(circle at 1px 1px, var(--oc-border-subtle) 1px, transparent 0);
  background-size: 22px 22px;
}

.oc-panel--background-checker {
  background-color: var(--oc-panel-bg);
  background-image:
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
  outline: 1px solid var(--oc-border-overlay-faint);
}

.oc-panel--padding-none {
  padding: var(--oc-padding-none);
}

.oc-panel--padding-compact {
  padding: var(--oc-padding-compact);
}

.oc-panel--padding-standard {
  padding: var(--oc-padding-standard);
}
</style>
