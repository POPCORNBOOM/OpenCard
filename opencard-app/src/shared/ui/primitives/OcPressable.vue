<template>
  <component
    :is="as"
    class="oc-pressable"
    :class="pressableClass"
    v-bind="resolvedAttrs"
    @keydown="handleNonButtonKeydown"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'
import {
  useOcPressableA11y,
  useOcPressableCapabilities,
  type OcPressableDensity,
  type OcPressableRadius,
  type OcPressableSize,
  type OcPressableVariant,
} from '../composables/useOcPressableCapabilities'

defineOptions({
  name: 'OcPressable',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: string
  variant?: OcPressableVariant
  size?: OcPressableSize
  density?: OcPressableDensity
  radius?: OcPressableRadius
  active?: boolean
  block?: boolean
  disabled?: boolean
  iconOnly?: boolean
  type?: 'button' | 'submit' | 'reset'
}>(), {
  as: 'button',
  variant: 'secondary',
  size: 'md',
  density: 'comfortable',
  radius: 'sm',
  active: false,
  block: false,
  disabled: false,
  iconOnly: false,
  type: 'button',
})

const attrs = useAttrs()
const { pressableClass } = useOcPressableCapabilities({
  variant: props.variant,
  size: props.size,
  density: props.density,
  radius: props.radius,
  active: props.active,
  block: props.block,
  disabled: props.disabled,
  iconOnly: props.iconOnly,
})

const { resolvedAttrs, handleNonButtonKeydown } = useOcPressableA11y({
  as: props.as,
  type: props.type,
  disabled: props.disabled,
}, attrs)
</script>

<style scoped>
.oc-pressable {
  --oc-pressable-gap: 6px;
  --oc-pressable-min-height: 26px;
  --oc-pressable-padding-block: 5px;
  --oc-pressable-padding-inline: 10px;
  --oc-pressable-font-size: 12px;
  --oc-pressable-density-padding-block: 0px;
  --oc-pressable-density-padding-inline: 0px;
  --oc-pressable-density-font-size: 0px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--oc-pressable-gap);
  border: 1px solid transparent;
  background: transparent;
  color: var(--oc-text-primary);
  cursor: pointer;
  font: inherit;
  font-size: calc(var(--oc-pressable-font-size) + var(--oc-pressable-density-font-size));
  line-height: 1.2;
  text-decoration: none;
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-pressable:not(.is-icon-only) {
  min-height: var(--oc-pressable-min-height);
  padding:
    calc(var(--oc-pressable-padding-block) + var(--oc-pressable-density-padding-block))
    calc(var(--oc-pressable-padding-inline) + var(--oc-pressable-density-padding-inline));
}

.oc-pressable.is-disabled,
.oc-pressable:disabled,
.oc-pressable[aria-disabled='true'] {
  cursor: default;
  opacity: 0.7;
  pointer-events: none;
}

.oc-pressable:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}

.oc-pressable.is-block {
  width: 100%;
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
  --oc-pressable-min-height: 22px;
  --oc-pressable-padding-block: 3px;
  --oc-pressable-padding-inline: 7px;
  --oc-pressable-font-size: 11px;
}

.oc-pressable--size-md {
  --oc-pressable-min-height: 26px;
  --oc-pressable-padding-block: 5px;
  --oc-pressable-padding-inline: 10px;
  --oc-pressable-font-size: 12px;
}

.oc-pressable--size-lg {
  --oc-pressable-min-height: 32px;
  --oc-pressable-padding-block: 7px;
  --oc-pressable-padding-inline: 14px;
  --oc-pressable-font-size: 13px;
}

.oc-pressable--density-compact {
  --oc-pressable-gap: 4px;
  --oc-pressable-density-padding-block: -1px;
  --oc-pressable-density-padding-inline: -2px;
  --oc-pressable-density-font-size: -1px;
}

.oc-pressable--density-comfortable {
  --oc-pressable-gap: 6px;
  --oc-pressable-density-padding-block: 0px;
  --oc-pressable-density-padding-inline: 0px;
  --oc-pressable-density-font-size: 0px;
}

.oc-pressable--density-spacious {
  --oc-pressable-gap: 8px;
  --oc-pressable-density-padding-block: 1px;
  --oc-pressable-density-padding-inline: 2px;
  --oc-pressable-density-font-size: 0px;
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
