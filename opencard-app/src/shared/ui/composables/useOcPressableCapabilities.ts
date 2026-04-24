import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useOcForwardAttrs, useOcModifierClasses, useOcStateClasses } from './useOcCapabilityClasses'

export const OC_PRESSABLE_VARIANTS = ['primary', 'secondary', 'ghost', 'icon', 'choice'] as const
export type OcPressableVariant = (typeof OC_PRESSABLE_VARIANTS)[number]

export const OC_PRESSABLE_SIZES = ['sm', 'md', 'lg'] as const
export type OcPressableSize = (typeof OC_PRESSABLE_SIZES)[number]

export const OC_PRESSABLE_DENSITIES = ['compact', 'comfortable', 'spacious'] as const
export type OcPressableDensity = (typeof OC_PRESSABLE_DENSITIES)[number]

export const OC_PRESSABLE_RADII = ['none', 'sm', 'md', 'lg'] as const
export type OcPressableRadius = (typeof OC_PRESSABLE_RADII)[number]

export interface OcPressableCapabilityProps {
  variant: MaybeRefOrGetter<OcPressableVariant>
  size: MaybeRefOrGetter<OcPressableSize>
  density: MaybeRefOrGetter<OcPressableDensity>
  radius: MaybeRefOrGetter<OcPressableRadius>
  active: MaybeRefOrGetter<boolean>
  block: MaybeRefOrGetter<boolean>
  disabled: MaybeRefOrGetter<boolean>
  iconOnly: MaybeRefOrGetter<boolean>
}

export interface OcPressableA11yProps {
  as: MaybeRefOrGetter<string>
  type: MaybeRefOrGetter<'button' | 'submit' | 'reset'>
  disabled: MaybeRefOrGetter<boolean>
}

export function useOcPressableCapabilities(props: OcPressableCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-pressable', () => [
    { value: toValue(props.variant) },
    { namespace: 'size', value: toValue(props.size) },
    { namespace: 'density', value: toValue(props.density) },
    { namespace: 'radius', value: toValue(props.radius) },
  ])

  const stateClasses = useOcStateClasses(() => ({
    active: toValue(props.active),
    block: toValue(props.block),
    disabled: toValue(props.disabled),
    'icon-only': toValue(props.iconOnly),
  }))

  const pressableClass = computed(() => [
    ...modifierClasses.value,
    ...stateClasses.value,
  ])

  return {
    pressableClass,
  }
}

export function useOcPressableA11y(
  props: OcPressableA11yProps,
  attrs: Record<string, unknown>,
) {
  const isButtonElement = computed(() => toValue(props.as) === 'button')
  const forwardedAttrs = useOcForwardAttrs(attrs)

  const resolvedAttrs = computed<Record<string, unknown>>(() => {
    const nextAttrs = { ...forwardedAttrs.value }
    if (isButtonElement.value) {
      return {
        ...nextAttrs,
        type: toValue(props.type),
        disabled: toValue(props.disabled),
      }
    }

    const roleAttr = nextAttrs.role
    const resolvedRole = typeof roleAttr === 'string'
      ? roleAttr
      : 'button'

    const tabindexAttr = nextAttrs.tabindex
    const resolvedTabindex = toValue(props.disabled)
      ? -1
      : (
          typeof tabindexAttr === 'string' || typeof tabindexAttr === 'number'
            ? tabindexAttr
            : 0
        )

    return {
      ...nextAttrs,
      role: resolvedRole,
      tabindex: resolvedTabindex,
      'aria-disabled': toValue(props.disabled) ? 'true' : undefined,
    }
  })

  function handleNonButtonKeydown(event: KeyboardEvent): void {
    if (isButtonElement.value || toValue(props.disabled) || event.repeat) {
      return
    }

    const isEnter = event.key === 'Enter'
    const isSpace = event.key === ' ' || event.key === 'Spacebar'
    if (!isEnter && !isSpace) {
      return
    }

    event.preventDefault()
    const currentTarget = event.currentTarget
    if (!(currentTarget instanceof HTMLElement)) {
      return
    }

    currentTarget.click()
  }

  return {
    resolvedAttrs,
    handleNonButtonKeydown,
  }
}
