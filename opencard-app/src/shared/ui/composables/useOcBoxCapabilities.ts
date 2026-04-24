import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'
import {
  OC_BOX_ALIGN_VALUES as FOUNDATION_OC_BOX_ALIGN_VALUES,
  OC_BOX_DIMENSION_TOKENS as FOUNDATION_OC_BOX_DIMENSION_TOKENS,
  OC_BOX_INSET_TOKENS as FOUNDATION_OC_BOX_INSET_TOKENS,
  OC_BOX_JUSTIFY_VALUES as FOUNDATION_OC_BOX_JUSTIFY_VALUES,
  OC_BOX_OVERFLOW_VALUES as FOUNDATION_OC_BOX_OVERFLOW_VALUES,
  OC_BOX_POINTER_VALUES as FOUNDATION_OC_BOX_POINTER_VALUES,
} from '../foundation/tokenRegistry'

export const OC_BOX_DIMENSION_TOKENS = FOUNDATION_OC_BOX_DIMENSION_TOKENS
export type OcBoxDimensionToken = (typeof OC_BOX_DIMENSION_TOKENS)[number]

export const OC_BOX_INSET_TOKENS = FOUNDATION_OC_BOX_INSET_TOKENS
export type OcBoxInsetToken = (typeof OC_BOX_INSET_TOKENS)[number]

export const OC_BOX_POINTER_VALUES = FOUNDATION_OC_BOX_POINTER_VALUES
export type OcBoxPointer = (typeof OC_BOX_POINTER_VALUES)[number]

export const OC_BOX_ALIGN_VALUES = FOUNDATION_OC_BOX_ALIGN_VALUES
export type OcBoxAlign = (typeof OC_BOX_ALIGN_VALUES)[number]

export const OC_BOX_JUSTIFY_VALUES = FOUNDATION_OC_BOX_JUSTIFY_VALUES
export type OcBoxJustify = (typeof OC_BOX_JUSTIFY_VALUES)[number]

export const OC_BOX_OVERFLOW_VALUES = FOUNDATION_OC_BOX_OVERFLOW_VALUES
export type OcBoxOverflow = (typeof OC_BOX_OVERFLOW_VALUES)[number]

export interface OcBoxCapabilityProps {
  inline: MaybeRefOrGetter<boolean>
  stack: MaybeRefOrGetter<boolean>
  center: MaybeRefOrGetter<boolean>
  grow: MaybeRefOrGetter<boolean>
  scrollY: MaybeRefOrGetter<boolean>
  fill: MaybeRefOrGetter<boolean>
  relative: MaybeRefOrGetter<boolean>
  absolute: MaybeRefOrGetter<boolean>
  inset: MaybeRefOrGetter<OcBoxInsetToken>
  width: MaybeRefOrGetter<OcBoxDimensionToken>
  height: MaybeRefOrGetter<OcBoxDimensionToken>
  pointer: MaybeRefOrGetter<OcBoxPointer>
  align: MaybeRefOrGetter<OcBoxAlign>
  justify: MaybeRefOrGetter<OcBoxJustify>
  overflow: MaybeRefOrGetter<OcBoxOverflow>
}

export function useOcBoxCapabilities(props: OcBoxCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-box', () => [
    { namespace: 'inset', value: toValue(props.inset) },
    { namespace: 'width', value: toValue(props.width) },
    { namespace: 'height', value: toValue(props.height) },
    { namespace: 'pointer', value: toValue(props.pointer) },
    { namespace: 'align', value: toValue(props.align) },
    { namespace: 'justify', value: toValue(props.justify) },
    { namespace: 'overflow', value: toValue(props.overflow) },
  ])

  const stateClasses = useOcStateClasses(() => ({
    inline: toValue(props.inline),
    stack: toValue(props.stack),
    center: toValue(props.center),
    grow: toValue(props.grow),
    'scroll-y': toValue(props.scrollY),
    fill: toValue(props.fill),
    relative: toValue(props.relative),
    absolute: toValue(props.absolute),
  }))

  const boxClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    boxClass,
  }
}
