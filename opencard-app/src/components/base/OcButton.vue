<!-- 组合按钮：由按压语义原语与表面样式原语组合而成，统一承载按钮视觉变体。 -->
<template>
  <OcPressable
    class="oc-base-button"
    :class="buttonClass"
    :size="size"
    :radius="radius"
    :icon-only="isIconOnly"
    :block="block"
    :disabled="disabled"
    :type="type"
    @click="handleClick"
  >
    <OcSurface
      as="span"
      class="oc-base-button__surface"
      :tone="resolvedSurface.tone"
      :border="resolvedSurface.border"
      :elevation="resolvedSurface.elevation"
      :radius="radius"
      fill
    >
      <OcIcon v-if="icon && iconPosition === 'left'" class="oc-base-button__icon" :name="icon" />
      <span v-if="!isIconOnly" class="oc-base-button__label">
        <slot />
      </span>
      <slot v-else />
      <OcIcon v-if="icon && iconPosition === 'right'" class="oc-base-button__icon" :name="icon" />
    </OcSurface>
  </OcPressable>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import {
  OC_PRESSABLE_RADII,
  OC_PRESSABLE_SIZES,
  OC_SURFACE_SHADOWS,
  OC_SURFACE_VARIANTS,
} from '../../shared/ui/foundation/tokenRegistry'
import { OcIcon, OcPressable, OcSurface } from '../../shared/ui/primitives'

type OcButtonVariant = 'primary' | 'secondary' | 'ghost' | 'choice' | 'icon'
type OcPressableSize = (typeof OC_PRESSABLE_SIZES)[number]
type OcPressableRadius = (typeof OC_PRESSABLE_RADII)[number]
type OcSurfaceTone = (typeof OC_SURFACE_VARIANTS)[number]
type OcSurfaceElevation = (typeof OC_SURFACE_SHADOWS)[number]
type OcSurfaceBorder = 'none' | 'subtle' | 'strong' | 'overlay'

interface OcButtonProps {
  /** 按钮视觉变体。 */
  variant?: OcButtonVariant
  /** 点击区域尺寸 token（OcPressable）。 */
  size?: OcPressableSize
  /** 点击区域圆角 token（OcPressable）。 */
  radius?: OcPressableRadius
  /** 左右图标名。 */
  icon?: string
  /** 图标相对文案位置。 */
  iconPosition?: 'left' | 'right'
  /** 是否强制 icon-only 模式。 */
  iconOnly?: boolean
  /** 是否显示激活态。 */
  active?: boolean
  /** 是否占满可用宽度。 */
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

defineOptions({ name: 'OcButton' })

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
const slots = useSlots()

const hasDefaultSlot = computed(() => Boolean(slots.default?.().length))
const isIconOnly = computed(() => props.iconOnly || (!hasDefaultSlot.value && Boolean(props.icon)))

const resolvedSurface = computed<{
  tone: OcSurfaceTone
  border: OcSurfaceBorder
  elevation: OcSurfaceElevation
}>(() => {
  if (props.variant === 'secondary') {
    return {
      tone: 'panel',
      border: 'subtle',
      elevation: 'none',
    }
  }

  if (props.variant === 'choice') {
    return {
      tone: 'input',
      border: 'subtle',
      elevation: 'none',
    }
  }

  return {
    tone: 'transparent',
    border: 'none',
    elevation: 'none',
  }
})

const buttonClass = computed(() => [
  `oc-base-button--variant-${props.variant}`,
  `oc-base-button--size-${props.size}`,
  {
    'oc-base-button--icon-only': isIconOnly.value,
    'oc-base-button--active': props.active,
  },
])

function handleClick(event: MouseEvent): void {
  emit('click', event)
}
</script>

<style scoped>
.oc-base-button {
  --oc-button-gap: 6px;
  --oc-button-min-height: 26px;
  --oc-button-padding-block: 5px;
  --oc-button-padding-inline: 10px;
  --oc-button-font-size: 12px;
  min-width: 0;
  color: var(--oc-text-primary);
}

.oc-base-button__surface {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--oc-button-gap);
  min-height: var(--oc-button-min-height);
  padding: var(--oc-button-padding-block) var(--oc-button-padding-inline);
  font-size: var(--oc-button-font-size);
  line-height: 1.2;
  color: inherit;
  white-space: nowrap;
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    box-shadow var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-base-button--icon-only .oc-base-button__surface {
  min-height: 0;
  padding: 0;
  gap: 0;
}

.oc-base-button__label {
  min-width: 0;
}

.oc-base-button__icon {
  flex-shrink: 0;
}

.oc-base-button--size-sm :deep(.oc-icon) {
  font-size: 12px;
}

.oc-base-button--size-md :deep(.oc-icon) {
  font-size: 14px;
}

.oc-base-button--size-lg :deep(.oc-icon) {
  font-size: 18px;
}

.oc-base-button--size-sm {
  --oc-button-min-height: 22px;
  --oc-button-padding-block: 3px;
  --oc-button-padding-inline: 7px;
  --oc-button-font-size: 11px;
}

.oc-base-button--size-md {
  --oc-button-min-height: 26px;
  --oc-button-padding-block: 5px;
  --oc-button-padding-inline: 10px;
  --oc-button-font-size: 12px;
}

.oc-base-button--size-lg {
  --oc-button-min-height: 32px;
  --oc-button-padding-block: 7px;
  --oc-button-padding-inline: 14px;
  --oc-button-font-size: 13px;
}

.oc-base-button--variant-primary {
  color: var(--oc-accent-contrast);
}

.oc-base-button--variant-primary .oc-base-button__surface {
  background: var(--oc-bg-accent);
}

.oc-base-button--variant-primary:hover:not(.is-disabled) .oc-base-button__surface {
  background: var(--oc-bg-accent-hover);
}

.oc-base-button--variant-secondary:hover:not(.is-disabled) .oc-base-button__surface,
.oc-base-button--variant-choice:hover:not(.is-disabled) .oc-base-button__surface {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-hover);
}

.oc-base-button--variant-ghost:hover:not(.is-disabled) .oc-base-button__surface {
  background: var(--oc-bg-hover);
}

.oc-base-button--variant-icon {
  color: var(--oc-text-soft);
}

.oc-base-button--variant-icon:hover:not(.is-disabled) {
  color: var(--oc-text-highlight);
}

.oc-base-button--variant-icon:hover:not(.is-disabled) .oc-base-button__surface {
  border-color: var(--oc-border-subtle);
  background: var(--oc-bg-hover);
}

.oc-base-button--active .oc-base-button__surface {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-active);
}
</style>
