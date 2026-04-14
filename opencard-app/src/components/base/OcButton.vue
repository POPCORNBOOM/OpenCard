<template>
  <button
    class="oc-button oc-base-button"
    :class="buttonClass"
    :type="type"
    :disabled="disabled"
  >
    <span
      v-if="icon && iconPosition === 'left'"
      class="oc-base-button__icon codicon"
      :class="icon"
      aria-hidden="true"
    />
    <slot />
    <span
      v-if="icon && iconPosition === 'right'"
      class="oc-base-button__icon codicon"
      :class="icon"
      aria-hidden="true"
    />
  </button>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'choice'
type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonRadius = 'none' | 'sm' | 'md' | 'lg'

defineOptions({ name: 'OcButton' })

const props = withDefaults(defineProps<{
  variant?: ButtonVariant
  size?: ButtonSize
  radius?: ButtonRadius
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

const buttonClass = computed(() => [
  `oc-button--${props.variant}`,
  `oc-base-button--size-${props.size}`,
  `oc-base-button--radius-${props.radius}`,
  {
    'oc-base-button--block': props.block,
    'oc-base-button--icon-only': isIconOnly.value,
    'is-active': props.active,
  },
])
</script>

<style scoped>
.oc-base-button {
  border-radius: 2px;
}

.oc-base-button--block {
  width: 100%;
}

.oc-base-button__icon {
  font-size: 14px;
  line-height: 1;
}

.oc-base-button--size-sm:not(.oc-base-button--icon-only) {
  min-height: 22px;
  padding: 3px 7px;
  font-size: 11px;
}

.oc-base-button--size-md:not(.oc-base-button--icon-only) {
  min-height: 26px;
  padding: 5px 10px;
  font-size: 12px;
}

.oc-base-button--size-lg:not(.oc-base-button--icon-only) {
  min-height: 32px;
  padding: 7px 14px;
  font-size: 13px;
}

.oc-base-button--radius-none {
  border-radius: 0;
}

.oc-base-button--radius-sm {
  border-radius: 2px;
}

.oc-base-button--radius-md {
  border-radius: 6px;
}

.oc-base-button--radius-lg {
  border-radius: 999px;
}

.oc-base-button--icon-only {
  padding: 0;
}

.oc-base-button--size-sm.oc-base-button--icon-only {
  width: 18px;
  height: 18px;
}

.oc-base-button--size-sm.oc-base-button--icon-only .oc-base-button__icon {
  font-size: 12px;
}

.oc-base-button--size-md.oc-base-button--icon-only {
  width: 22px;
  height: 22px;
}

.oc-base-button--size-md.oc-base-button--icon-only .oc-base-button__icon {
  font-size: 14px;
}

.oc-base-button--size-lg.oc-base-button--icon-only {
  width: 28px;
  height: 28px;
}

.oc-base-button--size-lg.oc-base-button--icon-only .oc-base-button__icon {
  font-size: 18px;
}
</style>
