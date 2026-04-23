import { computed } from 'vue'
import { useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'

export const OC_SURFACE_VARIANTS = ['panel', 'elevated', 'input', 'floating', 'transparent'] as const
export type OcSurfaceVariant = (typeof OC_SURFACE_VARIANTS)[number]

export const OC_SURFACE_RADII = ['none', 'sm', 'md', 'lg'] as const
export type OcSurfaceRadius = (typeof OC_SURFACE_RADII)[number]

export const OC_SURFACE_SHADOWS = ['none', 'sm', 'md', 'overlay'] as const
export type OcSurfaceShadow = (typeof OC_SURFACE_SHADOWS)[number]

export const OC_SURFACE_PATTERNS = ['none', 'dot-grid', 'checker-preview'] as const
export type OcSurfacePattern = (typeof OC_SURFACE_PATTERNS)[number]

export interface OcSurfaceCapabilityProps {
  variant: OcSurfaceVariant
  radius: OcSurfaceRadius
  shadow: OcSurfaceShadow
  pattern: OcSurfacePattern
  bordered: boolean
  fill: boolean
}

export function useOcSurfaceCapabilities(props: OcSurfaceCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-surface', () => [
    { value: props.variant },
    { namespace: 'radius', value: props.radius },
    { namespace: 'shadow', value: props.shadow },
    { namespace: 'pattern', value: props.pattern },
  ])

  const stateClasses = useOcStateClasses(() => ({
    bordered: props.bordered,
    fill: props.fill,
  }))

  const surfaceClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    surfaceClass,
  }
}
