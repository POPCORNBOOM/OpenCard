<!-- Base 按钮组件：独立实现按钮语义、状态管理与表面绘制，不依赖 shared primitives。 -->
<template>
  <button
    class="oc-base-button"
    :class="[buttonClass, attrs.class]"
    :style="[buttonStyle, attrs.style]"
    :type="type"
    :disabled="disabled"
    v-bind="forwardedAttrs"
    @click="emit('click', $event)"
  >
    <span class="oc-base-button__surface" :class="surfaceClass">
      <OcIcon v-if="icon && iconPosition === 'left'" class="oc-base-button__icon" :name="icon" :size="iconSize" />
      <span v-if="!isIconOnly" class="oc-base-button__label">
        <slot />
      </span>
      <slot v-else />
      <OcIcon v-if="icon && iconPosition === 'right'" class="oc-base-button__icon" :name="icon" :size="iconSize" />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import {
  OC_BUTTON_VARIANTS,
  OC_PRESSABLE_RADII,
  OC_PRESSABLE_SIZES,
} from '../../shared/ui/foundation/tokenRegistry'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from './OcIcon.vue'

type OcButtonVariant = (typeof OC_BUTTON_VARIANTS)[number]
type OcButtonSize = (typeof OC_PRESSABLE_SIZES)[number]
type OcButtonRadius = (typeof OC_PRESSABLE_RADII)[number]
type OcButtonIconSize = 'sm' | 'md' | 'lg'

interface OcButtonProps {
  /** 按钮视觉变体。 */
  variant?: OcButtonVariant
  /** 按钮尺寸 token。 */
  size?: OcButtonSize
  /** 按钮圆角 token。 */
  radius?: OcButtonRadius
  /** 左右图标名。 */
  icon?: IconToken
  /** 图标相对文案位置。 */
  iconPosition?: 'left' | 'right'
  /** 是否强制 icon-only 模式。 */
  iconOnly?: boolean
  /** 是否显示激活态。 */
  active?: boolean
  /** 是否占满父布局副轴（flex/grid 语境下生效）。 */
  block?: boolean
  /** 是否禁用按钮。 */
  disabled?: boolean
  /** 原生 button type。 */
  type?: 'button' | 'submit' | 'reset'
}

interface OcButtonEmits {
  /** 点击按钮时抛出。 */
  click: [event: MouseEvent]
}

interface SurfaceStateTokens {
  restBg: string
  restBorder: string
  hoverBg: string
  hoverBorder: string
  activeBg: string
  activeBorder: string
}

defineOptions({
  name: 'OcButton',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcButtonProps>(), {
  variant: 'secondary',
  size: 'md',
  radius: 'sm',
  icon: undefined,
  iconPosition: 'left',
  iconOnly: false,
  active: false,
  block: false,
  disabled: false,
  type: 'button',
})

const emit = defineEmits<OcButtonEmits>()
const attrs = useAttrs()
const slots = useSlots()

const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, type: _type, disabled: _disabled, ...rest } = attrs
  return rest
})

const hasDefaultSlot = computed(() => Boolean(slots.default?.().length))
const isIconOnly = computed(() => props.iconOnly || (!hasDefaultSlot.value && Boolean(props.icon)))

const iconSize = computed<OcButtonIconSize>(() => {
  if (props.size === 'sm') {
    return 'sm'
  }
  if (props.size === 'lg') {
    return 'lg'
  }
  return 'md'
})

const surfaceTokens = computed<SurfaceStateTokens>(() => {
  if (props.variant === 'primary') {
    return {
      restBg: 'var(--oc-bg-accent)',
      restBorder: 'transparent',
      hoverBg: 'var(--oc-bg-accent-hover)',
      hoverBorder: 'transparent',
      activeBg: 'var(--oc-bg-active)',
      activeBorder: 'var(--oc-bg-accent)',
    }
  }

  if (props.variant === 'choice') {
    return {
      restBg: 'var(--oc-bg-input)',
      restBorder: 'var(--oc-border-surface)',
      hoverBg: 'var(--oc-bg-hover)',
      hoverBorder: 'var(--oc-bg-accent)',
      activeBg: 'var(--oc-bg-active)',
      activeBorder: 'var(--oc-bg-accent)',
    }
  }

  if (props.variant === 'ghost') {
    return {
      restBg: 'transparent',
      restBorder: 'transparent',
      hoverBg: 'var(--oc-bg-hover)',
      hoverBorder: 'transparent',
      activeBg: 'var(--oc-bg-active)',
      activeBorder: 'var(--oc-bg-accent)',
    }
  }

  return {
    restBg: 'var(--oc-bg-panel)',
    restBorder: 'var(--oc-border-surface)',
    hoverBg: 'var(--oc-bg-hover)',
    hoverBorder: 'var(--oc-bg-accent)',
    activeBg: 'var(--oc-bg-active)',
    activeBorder: 'var(--oc-bg-accent)',
  }
})

const buttonStyle = computed<Record<string, string>>(() => ({
  '--oc-button-surface-bg-rest': surfaceTokens.value.restBg,
  '--oc-button-surface-border-rest': surfaceTokens.value.restBorder,
  '--oc-button-surface-bg-hover': surfaceTokens.value.hoverBg,
  '--oc-button-surface-border-hover': surfaceTokens.value.hoverBorder,
  '--oc-button-surface-bg-active': surfaceTokens.value.activeBg,
  '--oc-button-surface-border-active': surfaceTokens.value.activeBorder,
}))

const surfaceClass = computed(() => `oc-base-button__surface--radius-${props.radius}`)

const buttonClass = computed(() => [
  `oc-base-button--variant-${props.variant}`,
  `oc-base-button--size-${props.size}`,
  {
    'oc-base-button--icon-only': isIconOnly.value,
    'is-active': props.active,
    'is-block': props.block,
  },
])
</script>

<style scoped>
.oc-base-button {
  --oc-button-gap: var(--oc-padding-compact);
  --oc-button-block-size: var(--oc-block-md);
  --oc-button-inline-padding: var(--oc-padding-standard);
  --oc-button-font-size: var(--oc-body-size);
  --oc-button-fg: var(--oc-text-primary);
  --oc-button-hover-fg: var(--oc-button-fg);
  --oc-button-active-fg: var(--oc-button-hover-fg);
  --oc-button-surface-bg-rest: transparent;
  --oc-button-surface-border-rest: transparent;
  --oc-button-surface-bg-hover: var(--oc-button-surface-bg-rest);
  --oc-button-surface-border-hover: var(--oc-button-surface-border-rest);
  --oc-button-surface-bg-active: var(--oc-button-surface-bg-hover);
  --oc-button-surface-border-active: var(--oc-button-surface-border-hover);
  min-width: 0;
  min-height: var(--oc-button-block-size);
  padding: 0;
  margin: 0;
  border: 0;
  background: transparent;
  color: var(--oc-button-fg);
  font: inherit;
  line-height: inherit;
  text-decoration: none;
  cursor: pointer;
  display: inline-flex;
  align-items: stretch;
  justify-content: center;
}

.oc-base-button:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}

.oc-base-button:disabled {
  cursor: default;
  pointer-events: none;
  opacity: 0.7;
}

.oc-base-button.is-block {
  align-self: stretch;
  justify-self: stretch;
  width: auto;
}

.oc-base-button__surface {
  min-width: 0;
  width: 100%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--oc-button-gap);
  min-height: var(--oc-button-block-size);
  padding: var(--oc-padding-none) var(--oc-button-inline-padding);
  font-size: var(--oc-button-font-size);
  line-height: 1.2;
  color: inherit;
  white-space: nowrap;
  border: var(--oc-thickness-1) solid var(--oc-button-surface-border-rest);
  background: var(--oc-button-surface-bg-rest);
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-base-button__surface--radius-none {
  border-radius: 0;
}

.oc-base-button__surface--radius-sm {
  border-radius: var(--oc-radius-sm);
}

.oc-base-button__surface--radius-md {
  border-radius: var(--oc-radius-md);
}

.oc-base-button__surface--radius-lg {
  border-radius: var(--oc-radius-lg);
}

.oc-base-button--icon-only .oc-base-button__surface {
  width: var(--oc-button-block-size);
  height: var(--oc-button-block-size);
  min-height: 0;
  padding: var(--oc-padding-none);
  gap: var(--oc-padding-none);
}

.oc-base-button__label {
  min-width: 0;
}

.oc-base-button__icon {
  flex-shrink: 0;
}

.oc-base-button:hover:not(:disabled) {
  color: var(--oc-button-hover-fg);
}

.oc-base-button:hover:not(:disabled) .oc-base-button__surface {
  border-color: var(--oc-button-surface-border-hover);
  background: var(--oc-button-surface-bg-hover);
}

.oc-base-button:active:not(:disabled),
.oc-base-button.is-active:not(:disabled) {
  color: var(--oc-button-active-fg);
}

.oc-base-button:active:not(:disabled) .oc-base-button__surface,
.oc-base-button.is-active:not(:disabled) .oc-base-button__surface {
  border-color: var(--oc-button-surface-border-active);
  background: var(--oc-button-surface-bg-active);
}

.oc-base-button--size-sm {
  --oc-button-block-size: var(--oc-block-sm);
  --oc-button-inline-padding: var(--oc-padding-compact);
  --oc-button-font-size: var(--oc-label-size);
}

.oc-base-button--size-md {
  --oc-button-block-size: var(--oc-block-md);
  --oc-button-inline-padding: var(--oc-padding-standard);
  --oc-button-font-size: var(--oc-body-size);
}

.oc-base-button--size-lg {
  --oc-button-block-size: var(--oc-block-lg);
  --oc-button-inline-padding: calc(var(--oc-padding-standard) + var(--oc-padding-compact));
  --oc-button-font-size: var(--oc-title-size);
}

.oc-base-button--variant-primary {
  --oc-button-fg: var(--oc-accent-contrast);
  --oc-button-active-fg: var(--oc-accent-contrast);
}

</style>
