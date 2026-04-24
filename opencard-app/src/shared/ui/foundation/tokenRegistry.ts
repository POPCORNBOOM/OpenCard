export const OC_BOX_DIMENSION_TOKENS = ['auto', 'content', 'full', 'screen'] as const
export const OC_BOX_INSET_TOKENS = ['none', 'cover', 'origin'] as const
export const OC_BOX_POINTER_VALUES = ['auto', 'none'] as const
export const OC_BOX_ALIGN_VALUES = ['start', 'center', 'end', 'stretch'] as const
export const OC_BOX_JUSTIFY_VALUES = ['start', 'center', 'end', 'between'] as const
export const OC_BOX_OVERFLOW_VALUES = ['visible', 'hidden', 'auto'] as const

export const OC_PRESSABLE_VARIANTS = ['primary', 'secondary', 'ghost', 'icon', 'choice'] as const
export const OC_PRESSABLE_SIZES = ['sm', 'md', 'lg'] as const
export const OC_PRESSABLE_DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export const OC_PRESSABLE_RADII = ['none', 'sm', 'md', 'lg'] as const

export const OC_FIELD_CORE_VARIANTS = ['chromed', 'plain'] as const
export const OC_FIELD_CORE_SIZES = ['sm', 'md', 'lg'] as const
export const OC_FIELD_CORE_DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export const OC_FIELD_CORE_RESIZE_VALUES = ['none', 'horizontal', 'vertical', 'both'] as const

export const OC_SURFACE_VARIANTS = ['panel', 'elevated', 'input', 'floating', 'transparent', 'glass'] as const
export const OC_SURFACE_RADII = ['none', 'sm', 'md', 'lg'] as const
export const OC_SURFACE_SHADOWS = ['none', 'sm', 'md', 'overlay'] as const
export const OC_SURFACE_PATTERNS = ['none', 'dot-grid', 'checker-preview'] as const

export const OC_TRACK_SIZE_TOKENS = [
  'auto',
  'fill',
  'fill-2',
  'fill-3',
  'size-xs',
  'size-sm',
  'size-md',
  'size-lg',
  'size-xl',
  'size-2xl',
  'size-3xl',
  'panel-sm',
  'panel-md',
  'panel-lg',
  'panel-xl',
  'panel-2xl',
  'panel-max',
  'workspace-tree',
  'workspace-property-min',
] as const

export type OcSize = (typeof OC_TRACK_SIZE_TOKENS)[number]

export const OC_TRACK_BOUND_SIZE_TOKENS = [
  'size-xs',
  'size-sm',
  'size-md',
  'size-lg',
  'size-xl',
  'size-2xl',
  'size-3xl',
  'panel-sm',
  'panel-md',
  'panel-lg',
  'panel-xl',
  'panel-2xl',
  'panel-max',
  'workspace-tree',
  'workspace-property-min',
] as const

export type OcBoundSize = (typeof OC_TRACK_BOUND_SIZE_TOKENS)[number]
export type OcTrackBoundSizeMetric = number | { cssVar: string; fallback: number }

export interface OcTrackRegion {
  slot: string
  size?: OcSize
  min?: OcBoundSize
  max?: OcBoundSize
  resizable?: boolean
  resizerAriaLabel?: string
}

export const OC_TRACK_DEFAULT_SIZE_TOKEN: OcSize = 'fill'

export const OC_TRACK_SIZE_TEMPLATE_MAP: Record<OcSize, string> = {
  auto: 'auto',
  fill: 'minmax(0, 1fr)',
  'fill-2': 'minmax(0, 2fr)',
  'fill-3': 'minmax(0, 3fr)',
  'size-xs': '36px',
  'size-sm': '48px',
  'size-md': '72px',
  'size-lg': '96px',
  'size-xl': '120px',
  'size-2xl': '160px',
  'size-3xl': '320px',
  'panel-sm': '140px',
  'panel-md': '180px',
  'panel-lg': '220px',
  'panel-xl': '320px',
  'panel-2xl': '420px',
  'panel-max': '640px',
  'workspace-tree': 'var(--card-editor-tree-panel-height, 320px)',
  'workspace-property-min': 'var(--card-editor-min-property-panel-height, 180px)',
}

export const OC_TRACK_BOUND_METRIC_MAP: Record<OcBoundSize, OcTrackBoundSizeMetric> = {
  'size-xs': 36,
  'size-sm': 48,
  'size-md': 72,
  'size-lg': 96,
  'size-xl': 120,
  'size-2xl': 160,
  'size-3xl': 320,
  'panel-sm': 140,
  'panel-md': 180,
  'panel-lg': 220,
  'panel-xl': 320,
  'panel-2xl': 420,
  'panel-max': 640,
  'workspace-tree': { cssVar: '--card-editor-tree-panel-height', fallback: 320 },
  'workspace-property-min': { cssVar: '--card-editor-min-property-panel-height', fallback: 180 },
}

export function resolveOcTrackSizeTemplate(size: OcSize | undefined): string {
  return OC_TRACK_SIZE_TEMPLATE_MAP[size ?? OC_TRACK_DEFAULT_SIZE_TOKEN]
}

type CssVariableReader = (cssVar: string, fallback: number) => number

export function resolveOcTrackBoundPixels(
  size: OcBoundSize | undefined,
  fallback: number,
  readCssVariable?: CssVariableReader,
): number {
  if (!size) {
    return fallback
  }

  const metric = OC_TRACK_BOUND_METRIC_MAP[size]
  if (metric === undefined) {
    return fallback
  }

  if (typeof metric === 'number') {
    return metric
  }

  if (!readCssVariable) {
    return metric.fallback
  }

  return readCssVariable(metric.cssVar, metric.fallback)
}
