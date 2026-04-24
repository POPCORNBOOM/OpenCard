import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'

export const OC_FIELD_CORE_VARIANTS = ['chromed', 'plain'] as const
export type OcFieldCoreVariant = (typeof OC_FIELD_CORE_VARIANTS)[number]

export const OC_FIELD_CORE_SIZES = ['sm', 'md', 'lg'] as const
export type OcFieldCoreSize = (typeof OC_FIELD_CORE_SIZES)[number]

export const OC_FIELD_CORE_DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export type OcFieldCoreDensity = (typeof OC_FIELD_CORE_DENSITIES)[number]

export const OC_FIELD_CORE_RESIZE_VALUES = ['none', 'horizontal', 'vertical', 'both'] as const
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
