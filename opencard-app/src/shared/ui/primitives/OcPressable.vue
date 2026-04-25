<!-- 交互语义原语：只负责按压语义、可访问性与点击区域几何，不承载视觉状态样式。 -->
<template>
  <component
    :is="as"
    class="oc-pressable"
    :class="pressableClass"
    :style="forwardedStyle"
    v-bind="resolvedAttrs"
    @keydown="handleNonButtonKeydown"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useOcForwardAttrs } from '../composables/useOcCapabilityClasses'
import { OC_PRESSABLE_RADII, OC_PRESSABLE_SIZES } from '../foundation/tokenRegistry'

type OcPressableSize = (typeof OC_PRESSABLE_SIZES)[number]
type OcPressableRadius = (typeof OC_PRESSABLE_RADII)[number]

interface OcPressableProps {
  /** 根元素标签。 */
  as?: string
  /** 点击区域尺寸 token。 */
  size?: OcPressableSize
  /** 点击区域圆角 token。 */
  radius?: OcPressableRadius
  /** 是否占满可用宽度。 */
  block?: boolean
  /** 是否禁用交互。 */
  disabled?: boolean
  /** 是否使用正方形点击区域。 */
  iconOnly?: boolean
  /** 当 as=button 时生效的按钮类型。 */
  type?: 'button' | 'submit' | 'reset'
}

defineOptions({
  name: 'OcPressable',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcPressableProps>(), {
  as: 'button',
  size: 'md',
  radius: 'sm',
  block: false,
  disabled: false,
  iconOnly: false,
  type: 'button',
})

const attrs = useAttrs()
const forwardedAttrs = useOcForwardAttrs(attrs, [
  'style',
  'variant',
  'density',
  'active',
  'icon-only',
  'iconOnly',
  'slotted-fill',
  'slottedFill',
])
const forwardedStyle = computed(() => attrs.style)
const isButtonElement = computed(() => props.as === 'button')

const resolvedRole = computed(() => {
  if (isButtonElement.value) {
    return undefined
  }

  const roleAttr = forwardedAttrs.value.role
  return typeof roleAttr === 'string' ? roleAttr : 'button'
})

const isButtonLikeRole = computed(() => resolvedRole.value === 'button')

const resolvedAttrs = computed<Record<string, unknown>>(() => {
  const nextAttrs = { ...forwardedAttrs.value }

  if (isButtonElement.value) {
    return {
      ...nextAttrs,
      type: props.type,
      disabled: props.disabled,
    }
  }

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
    role: resolvedRole.value,
    tabindex: resolvedTabindex,
    'aria-disabled': props.disabled ? 'true' : undefined,
  }
})

const pressableClass = computed(() => [
  `oc-pressable--size-${props.size}`,
  `oc-pressable--radius-${props.radius}`,
  {
    'is-block': props.block,
    'is-disabled': props.disabled,
    'is-icon-only': props.iconOnly,
  },
])

function handleNonButtonKeydown(event: KeyboardEvent): void {
  if (isButtonElement.value || props.disabled || event.repeat || !isButtonLikeRole.value) {
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
</script>

<style scoped>
.oc-pressable {
  --oc-pressable-hit-size: 26px;
  min-width: 0;
  min-height: var(--oc-pressable-hit-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  line-height: inherit;
  text-decoration: none;
}

.oc-pressable.is-icon-only {
  width: var(--oc-pressable-hit-size);
  height: var(--oc-pressable-hit-size);
  min-height: 0;
}

.oc-pressable.is-block {
  width: 100%;
}

.oc-pressable.is-disabled,
.oc-pressable:disabled,
.oc-pressable[aria-disabled='true'] {
  cursor: default;
  pointer-events: none;
  opacity: 0.7;
}

.oc-pressable:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}

.oc-pressable:hover:not(:disabled):not([aria-disabled='true']) {
  background: transparent;
}

.oc-pressable:active:not(:disabled):not([aria-disabled='true']) {
  background: transparent;
}

.oc-pressable--radius-none {
  border-radius: 0;
}

.oc-pressable--radius-sm {
  border-radius: var(--oc-radius-sm);
}

.oc-pressable--radius-md {
  border-radius: var(--oc-radius-md);
}

.oc-pressable--radius-lg {
  border-radius: var(--oc-radius-pill);
}

.oc-pressable--size-sm {
  --oc-pressable-hit-size: 22px;
}

.oc-pressable--size-md {
  --oc-pressable-hit-size: 26px;
}

.oc-pressable--size-lg {
  --oc-pressable-hit-size: 32px;
}
</style>
