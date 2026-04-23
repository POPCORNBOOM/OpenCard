import { computed } from 'vue'
import { useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'

export const OC_BOX_DIMENSION_TOKENS = ['auto', 'content', 'full', 'screen'] as const
export type OcBoxDimensionToken = (typeof OC_BOX_DIMENSION_TOKENS)[number]

export const OC_BOX_INSET_TOKENS = ['none', 'cover', 'origin'] as const
export type OcBoxInsetToken = (typeof OC_BOX_INSET_TOKENS)[number]

export const OC_BOX_POINTER_VALUES = ['auto', 'none'] as const
export type OcBoxPointer = (typeof OC_BOX_POINTER_VALUES)[number]

export const OC_BOX_ALIGN_VALUES = ['start', 'center', 'end', 'stretch'] as const
export type OcBoxAlign = (typeof OC_BOX_ALIGN_VALUES)[number]

export const OC_BOX_JUSTIFY_VALUES = ['start', 'center', 'end', 'between'] as const
export type OcBoxJustify = (typeof OC_BOX_JUSTIFY_VALUES)[number]

export const OC_BOX_OVERFLOW_VALUES = ['visible', 'hidden', 'auto'] as const
export type OcBoxOverflow = (typeof OC_BOX_OVERFLOW_VALUES)[number]

export interface OcBoxCapabilityProps {
  inline: boolean
  stack: boolean
  center: boolean
  grow: boolean
  scrollY: boolean
  fill: boolean
  relative: boolean
  absolute: boolean
  inset: OcBoxInsetToken
  width: OcBoxDimensionToken
  height: OcBoxDimensionToken
  pointer: OcBoxPointer
  align: OcBoxAlign
  justify: OcBoxJustify
  overflow: OcBoxOverflow
}

export function useOcBoxCapabilities(props: OcBoxCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-box', () => [
    { namespace: 'inset', value: props.inset },
    { namespace: 'width', value: props.width },
    { namespace: 'height', value: props.height },
    { namespace: 'pointer', value: props.pointer },
    { namespace: 'align', value: props.align },
    { namespace: 'justify', value: props.justify },
    { namespace: 'overflow', value: props.overflow },
  ])

  const stateClasses = useOcStateClasses(() => ({
    inline: props.inline,
    stack: props.stack,
    center: props.center,
    grow: props.grow,
    'scroll-y': props.scrollY,
    fill: props.fill,
    relative: props.relative,
    absolute: props.absolute,
  }))

  const boxClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    boxClass,
  }
}
