<template>
  <OcPressable
    class="oc-base-button"
    :class="buttonClass"
    :style="buttonStyle"
    :variant="variant"
    :size="size"
    :radius="radius"
    :icon-only="isIconOnly"
    :active="active"
    :block="block"
    :disabled="disabled"
    :type="type"
  >
    <OcIcon
      v-if="icon && iconPosition === 'left'"
      class="oc-base-button__icon"
      :name="icon"
    />
    <slot />
    <OcIcon
      v-if="icon && iconPosition === 'right'"
      class="oc-base-button__icon"
      :name="icon"
    />
  </OcPressable>
</template>

<script setup lang="ts">
import { computed, useSlots, type CSSProperties } from 'vue'
import { OcIcon, OcPressable } from '../../shared/ui/primitives'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'choice'
type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonRadius = 'none' | 'sm' | 'md' | 'lg'

defineOptions({ name: 'OcButton' })

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  radius?: ButtonRadius
  minHeight?: string
  icon?: string
  iconPosition?: 'left' | 'right'
  iconOnly?: boolean
  active?: boolean
  block?: boolean
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  variant: 'secondary',
  size: 'md',
  radius: 'sm',
  minHeight: undefined,
  icon: undefined,
  iconPosition: 'left',
  iconOnly: false,
  active: false,
  block: false,
  disabled: false,
  type: 'button',
})

const slots = useSlots()

const hasDefaultSlot = computed(() => Boolean(slots.default?.().length))
const isIconOnly = computed(() => props.iconOnly || (!hasDefaultSlot.value && Boolean(props.icon)))
const buttonStyle = computed<CSSProperties>(() => {
  if (!props.minHeight) {
    return {}
  }

  return {
    minHeight: props.minHeight,
  }
})

const buttonClass = computed(() => [
  `oc-base-button--variant-${props.variant}`,
  `oc-base-button--size-${props.size}`,
  {
    'oc-base-button--icon-only': isIconOnly.value,
  },
])
</script>

<style scoped>
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
</style>
