import { computed, toValue, type MaybeRefOrGetter } from 'vue'
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
  variant: MaybeRefOrGetter<OcSurfaceVariant>
  radius: MaybeRefOrGetter<OcSurfaceRadius>
  shadow: MaybeRefOrGetter<OcSurfaceShadow>
  pattern: MaybeRefOrGetter<OcSurfacePattern>
  bordered: MaybeRefOrGetter<boolean>
  fill: MaybeRefOrGetter<boolean>
}

export function useOcSurfaceCapabilities(props: OcSurfaceCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-surface', () => [
    { value: toValue(props.variant) },
    { namespace: 'radius', value: toValue(props.radius) },
    { namespace: 'shadow', value: toValue(props.shadow) },
    { namespace: 'pattern', value: toValue(props.pattern) },
  ])

  const stateClasses = useOcStateClasses(() => ({
    bordered: toValue(props.bordered),
    fill: toValue(props.fill),
  }))

  const surfaceClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    surfaceClass,
  }
}
