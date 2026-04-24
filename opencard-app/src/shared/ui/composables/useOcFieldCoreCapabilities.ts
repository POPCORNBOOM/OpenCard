import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'
import {
  OC_FIELD_CORE_DENSITIES as FOUNDATION_OC_FIELD_CORE_DENSITIES,
  OC_FIELD_CORE_RESIZE_VALUES as FOUNDATION_OC_FIELD_CORE_RESIZE_VALUES,
  OC_FIELD_CORE_SIZES as FOUNDATION_OC_FIELD_CORE_SIZES,
  OC_FIELD_CORE_VARIANTS as FOUNDATION_OC_FIELD_CORE_VARIANTS,
} from '../foundation/tokenRegistry'

export const OC_FIELD_CORE_VARIANTS = FOUNDATION_OC_FIELD_CORE_VARIANTS
export type OcFieldCoreVariant = (typeof OC_FIELD_CORE_VARIANTS)[number]

export const OC_FIELD_CORE_SIZES = FOUNDATION_OC_FIELD_CORE_SIZES
export type OcFieldCoreSize = (typeof OC_FIELD_CORE_SIZES)[number]

export const OC_FIELD_CORE_DENSITIES = FOUNDATION_OC_FIELD_CORE_DENSITIES
export type OcFieldCoreDensity = (typeof OC_FIELD_CORE_DENSITIES)[number]

export const OC_FIELD_CORE_RESIZE_VALUES = FOUNDATION_OC_FIELD_CORE_RESIZE_VALUES
export type OcFieldCoreResize = (typeof OC_FIELD_CORE_RESIZE_VALUES)[number]

export interface OcFieldCoreCapabilityProps {
  as: MaybeRefOrGetter<'input' | 'select' | 'textarea'>
  variant: MaybeRefOrGetter<OcFieldCoreVariant>
  fullWidth: MaybeRefOrGetter<boolean>
  monospace: MaybeRefOrGetter<boolean>
  size: MaybeRefOrGetter<OcFieldCoreSize>
  density: MaybeRefOrGetter<OcFieldCoreDensity>
  resize: MaybeRefOrGetter<OcFieldCoreResize>
}

export function useOcFieldCoreCapabilities(props: OcFieldCoreCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-field-core', () => [
    { namespace: 'variant', value: toValue(props.variant) },
    { namespace: 'width', value: toValue(props.fullWidth) ? 'full' : 'auto' },
    { namespace: 'font', value: toValue(props.monospace) ? 'mono' : 'ui' },
    { namespace: 'size', value: toValue(props.size) },
    { namespace: 'density', value: toValue(props.density) },
    { namespace: 'resize', value: toValue(props.as) === 'textarea' ? toValue(props.resize) : 'none' },
  ])

  const stateClasses = useOcStateClasses(() => ({
    chromed: toValue(props.variant) === 'chromed',
    plain: toValue(props.variant) === 'plain',
    'full-width': toValue(props.fullWidth),
    monospace: toValue(props.monospace),
  }))

  const fieldClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    fieldClass,
  }
}
