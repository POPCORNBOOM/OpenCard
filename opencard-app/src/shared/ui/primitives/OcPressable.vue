<template>
  <component
    :is="as"
    class="oc-pressable oc-button"
    :class="pressableClass"
    v-bind="resolvedAttrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

type PressableVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'choice'
type PressableSize = 'sm' | 'md' | 'lg'
type PressableRadius = 'none' | 'sm' | 'md' | 'lg'

defineOptions({
  name: 'OcPressable',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: string
  variant?: PressableVariant
  size?: PressableSize
  radius?: PressableRadius
  active?: boolean
  block?: boolean
  disabled?: boolean
  iconOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  as: 'button',
  variant: 'secondary',
  size: 'md',
  radius: 'sm',
  active: false,
  block: false,
  disabled: false,
  iconOnly: false,
  type: 'button',
})

const attrs = useAttrs()

const isButtonElement = computed(() => props.as === 'button')

const resolvedAttrs = computed(() => {
  const nextAttrs = { ...attrs }
  if (isButtonElement.value) {
    return {
      ...nextAttrs,
      type: props.type,
      disabled: props.disabled,
    }
  }

  return {
    ...nextAttrs,
    'aria-disabled': props.disabled ? 'true' : undefined,
    tabindex: props.disabled ? -1 : nextAttrs.tabindex,
  }
})

const pressableClass = computed(() => [
  `oc-pressable--${props.variant}`,
  `oc-button--${props.variant}`,
  `oc-pressable--size-${props.size}`,
  `oc-pressable--radius-${props.radius}`,
  {
    'is-active': props.active,
    'is-block': props.block,
    'is-icon-only': props.iconOnly,
  },
])
</script>

<style scoped>
.oc-pressable {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--oc-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: var(--oc-body-size);
  line-height: 1.2;
  text-decoration: none;
  transition: border-color 0.12s ease, background-color 0.12s ease, color 0.12s ease;
}

.oc-pressable:disabled,
.oc-pressable[aria-disabled='true'] {
  cursor: default;
  opacity: 0.7;
  pointer-events: none;
}

.oc-pressable:focus-visible {
  outline: 2px solid var(--oc-accent-glow);
  outline-offset: 1px;
}

.oc-pressable.is-block {
  width: 100%;
}

.oc-pressable--radius-none {
  border-radius: 0;
}

.oc-pressable--radius-sm {
  border-radius: 2px;
}

.oc-pressable--radius-md {
  border-radius: 6px;
}

.oc-pressable--radius-lg {
  border-radius: 999px;
}

.oc-pressable--size-sm:not(.is-icon-only) {
  min-height: 22px;
  padding: 3px 7px;
  font-size: 11px;
}

.oc-pressable--size-md:not(.is-icon-only) {
  min-height: 26px;
  padding: 5px 10px;
  font-size: 12px;
}

.oc-pressable--size-lg:not(.is-icon-only) {
  min-height: 32px;
  padding: 7px 14px;
  font-size: 13px;
}

.oc-pressable.is-icon-only {
  padding: 0;
}

.oc-pressable--size-sm.is-icon-only {
  width: 18px;
  height: 18px;
}

.oc-pressable--size-md.is-icon-only {
  width: 22px;
  height: 22px;
}

.oc-pressable--size-lg.is-icon-only {
  width: 28px;
  height: 28px;
}

.oc-pressable--primary {
  background: var(--oc-bg-accent);
  color: var(--oc-accent-contrast);
}

.oc-pressable--primary:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--oc-bg-accent-hover);
}

.oc-pressable--secondary {
  border-color: var(--oc-border-subtle);
  background: var(--oc-bg-panel);
}

.oc-pressable--secondary:hover:not(:disabled):not([aria-disabled='true']) {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-hover);
}

.oc-pressable--ghost:hover:not(:disabled):not([aria-disabled='true']) {
  background: var(--oc-bg-hover);
}

.oc-pressable--icon {
  color: var(--oc-text-soft);
}

.oc-pressable--icon:hover:not(:disabled):not([aria-disabled='true']) {
  color: var(--oc-text-highlight);
  border-color: var(--oc-border-subtle);
  background: var(--oc-bg-hover);
}

.oc-pressable--icon.is-active {
  color: var(--oc-text-highlight);
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-active);
}

.oc-pressable--choice {
  min-width: 0;
  border-color: var(--oc-border-input);
  background: var(--oc-bg-input);
}

.oc-pressable--choice:hover:not(:disabled):not([aria-disabled='true']) {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-hover);
}

.oc-pressable--choice.is-active {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-active);
}
</style>

