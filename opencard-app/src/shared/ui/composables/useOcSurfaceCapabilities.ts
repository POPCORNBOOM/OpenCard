import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'
import {
  OC_SURFACE_PATTERNS as FOUNDATION_OC_SURFACE_PATTERNS,
  OC_SURFACE_RADII as FOUNDATION_OC_SURFACE_RADII,
  OC_SURFACE_SHADOWS as FOUNDATION_OC_SURFACE_SHADOWS,
  OC_SURFACE_VARIANTS as FOUNDATION_OC_SURFACE_VARIANTS,
} from '../foundation/tokenRegistry'

export const OC_SURFACE_VARIANTS = FOUNDATION_OC_SURFACE_VARIANTS
export type OcSurfaceVariant = (typeof OC_SURFACE_VARIANTS)[number]

export const OC_SURFACE_RADII = FOUNDATION_OC_SURFACE_RADII
export type OcSurfaceRadius = (typeof OC_SURFACE_RADII)[number]

export const OC_SURFACE_SHADOWS = FOUNDATION_OC_SURFACE_SHADOWS
export type OcSurfaceShadow = (typeof OC_SURFACE_SHADOWS)[number]

export const OC_SURFACE_PATTERNS = FOUNDATION_OC_SURFACE_PATTERNS
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
