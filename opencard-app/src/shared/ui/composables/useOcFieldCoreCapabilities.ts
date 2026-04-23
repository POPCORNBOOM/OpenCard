import { computed } from 'vue'
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
  as: 'input' | 'select' | 'textarea'
  variant: OcFieldCoreVariant
  fullWidth: boolean
  monospace: boolean
  size: OcFieldCoreSize
  density: OcFieldCoreDensity
  resize: OcFieldCoreResize
}

export function useOcFieldCoreCapabilities(props: OcFieldCoreCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-field-core', () => [
    { namespace: 'variant', value: props.variant },
    { namespace: 'width', value: props.fullWidth ? 'full' : 'auto' },
    { namespace: 'font', value: props.monospace ? 'mono' : 'ui' },
    { namespace: 'size', value: props.size },
    { namespace: 'density', value: props.density },
    { namespace: 'resize', value: props.as === 'textarea' ? props.resize : 'none' },
  ])

  const stateClasses = useOcStateClasses(() => ({
    chromed: props.variant === 'chromed',
    plain: props.variant === 'plain',
    'full-width': props.fullWidth,
    monospace: props.monospace,
  }))

  const fieldClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    fieldClass,
  }
}
