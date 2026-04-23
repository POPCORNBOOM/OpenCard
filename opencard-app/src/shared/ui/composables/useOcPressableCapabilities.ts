import { computed } from 'vue'
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
  variant: OcPressableVariant
  size: OcPressableSize
  density: OcPressableDensity
  radius: OcPressableRadius
  active: boolean
  block: boolean
  disabled: boolean
  iconOnly: boolean
}

export interface OcPressableA11yProps {
  as: string
  type: 'button' | 'submit' | 'reset'
  disabled: boolean
}

export function useOcPressableCapabilities(props: OcPressableCapabilityProps) {
  const modifierClasses = useOcModifierClasses('oc-pressable', () => [
    { value: props.variant },
    { namespace: 'size', value: props.size },
    { namespace: 'density', value: props.density },
    { namespace: 'radius', value: props.radius },
  ])

  const stateClasses = useOcStateClasses(() => ({
    active: props.active,
    block: props.block,
    disabled: props.disabled,
    'icon-only': props.iconOnly,
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
  const isButtonElement = computed(() => props.as === 'button')
  const forwardedAttrs = useOcForwardAttrs(attrs)

  const resolvedAttrs = computed<Record<string, unknown>>(() => {
    const nextAttrs = { ...forwardedAttrs.value }
    if (isButtonElement.value) {
      return {
        ...nextAttrs,
        type: props.type,
        disabled: props.disabled,
      }
    }

    const roleAttr = nextAttrs.role
    const resolvedRole = typeof roleAttr === 'string'
      ? roleAttr
      : 'button'

    const tabindexAttr = nextAttrs.tabindex
    const resolvedTabindex = props.disabled
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
      'aria-disabled': props.disabled ? 'true' : undefined,
    }
  })

  function handleNonButtonKeydown(event: KeyboardEvent): void {
    if (isButtonElement.value || props.disabled || event.repeat) {
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
