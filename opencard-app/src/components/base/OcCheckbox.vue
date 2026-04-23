<template>
  <label
    class="oc-checkbox"
    :class="rootClass"
    :style="rootStyle"
  >
    <input
      class="oc-checkbox__input"
      type="checkbox"
      :checked="checked"
      :disabled="disabled"
      v-bind="forwardedInputAttrs"
      @change="handleChange"
    />
    <span class="oc-checkbox__control" aria-hidden="true">
      <span class="oc-checkbox__mark" />
    </span>
    <OcText v-if="hasLabelContent" as="span" class="oc-checkbox__label" tone="primary">
      <slot>{{ label }}</slot>
    </OcText>
  </label>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots } from 'vue'
import { OcText } from '../../shared/ui/primitives'

defineOptions({
  name: 'OcCheckbox',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  checked?: boolean
  disabled?: boolean
  label?: string
}>(), {
  checked: false,
  disabled: false,
  label: undefined,
})

const emit = defineEmits<{
  'update:checked': [value: boolean]
  change: [value: boolean, event: Event]
}>()

const attrs = useAttrs()
const slots = useSlots()

const hasLabelContent = computed(() => {
  return Boolean(slots.default?.().length) || Boolean(props.label)
})

const checkboxStateClass = computed(() => ({
  'is-checked': props.checked,
  'is-disabled': props.disabled,
}))

const rootClass = computed(() => [checkboxStateClass.value, attrs.class])
const rootStyle = computed(() => attrs.style)

const forwardedInputAttrs = computed(() => {
  const {
    class: _class,
    style: _style,
    checked: _checked,
    disabled: _disabled,
    ...rest
  } = attrs

  return rest
})

function handleChange(event: Event): void {
  const target = event.target as HTMLInputElement | null
  if (!target) {
    return
  }

  emit('update:checked', target.checked)
  emit('change', target.checked, event)
}
</script>

<style scoped>
.oc-checkbox {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
  min-width: 0;
  color: var(--oc-text-primary);
  font-size: var(--oc-body-size);
  cursor: pointer;
  user-select: none;
}

.oc-checkbox.is-disabled {
  color: var(--oc-text-disabled);
  cursor: not-allowed;
}

.oc-checkbox__input {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  border: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.oc-checkbox__control {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  border-radius: var(--oc-radius-sm);
  border: 1px solid var(--oc-border-input);
  background: var(--oc-bg-input);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-checkbox:hover:not(.is-disabled) .oc-checkbox__control {
  border-color: var(--oc-border-default);
  background: var(--oc-bg-hover);
}

.oc-checkbox__mark {
  width: 4px;
  height: 7px;
  border: solid var(--oc-accent-contrast);
  border-width: 0 2px 2px 0;
  transform: rotate(45deg) scale(0.85);
  transform-origin: center;
  opacity: 0;
  transition:
    opacity var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    transform var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-checkbox__input:focus-visible + .oc-checkbox__control {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}

.oc-checkbox__input:checked + .oc-checkbox__control {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-accent);
}

.oc-checkbox__input:checked + .oc-checkbox__control .oc-checkbox__mark {
  opacity: 1;
  transform: rotate(45deg) scale(1);
}

.oc-checkbox__input:disabled + .oc-checkbox__control {
  border-color: var(--oc-border-subtle);
  background: var(--oc-bg-subtle);
}

.oc-checkbox__input:disabled:checked + .oc-checkbox__control {
  border-color: var(--oc-border-subtle);
  background: var(--oc-bg-active);
}

.oc-checkbox__input:disabled + .oc-checkbox__control .oc-checkbox__mark {
  border-color: var(--oc-text-disabled);
}

.oc-checkbox__label {
  min-width: 0;
  line-height: 1.3;
}
</style>
