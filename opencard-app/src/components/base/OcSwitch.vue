<!-- Base 开关：表达立即生效的二元状态，支持 v-model:checked 双向绑定。 -->

<template>
  <label class="oc-switch" :class="[{ 'oc-switch--disabled': disabled }, attrs.class]" :style="attrs.style">
    <input
      type="checkbox"
      role="switch"
      class="oc-switch__input"
      :checked="checked"
      :aria-checked="checked"
      :disabled="disabled"
      v-bind="inputAttrs"
      @change="handleChange"
    />
    <span class="oc-switch__track" aria-hidden="true">
      <span class="oc-switch__thumb" />
    </span>
    <span v-if="label || $slots.default" class="oc-switch__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'

defineOptions({ name: 'OcSwitch', inheritAttrs: false })

interface Props {
  checked?: boolean
  disabled?: boolean
  label?: string
}

withDefaults(defineProps<Props>(), {
  checked: false,
  disabled: false,
})

const attrs = useAttrs()
const inputAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

const emit = defineEmits<{
  'update:checked': [value: boolean]
  'change': [value: boolean, event: Event]
}>()

function handleChange(event: Event): void {
  const value = (event.target as HTMLInputElement).checked
  emit('update:checked', value)
  emit('change', value, event)
}
</script>

<style scoped>
.oc-switch {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
  color: var(--oc-fg-default);
  font-size: var(--oc-text-base);
  cursor: pointer;
}

.oc-switch__input {
  position: absolute;
  width: 0;
  height: 0;
  margin: 0;
  opacity: 0;
}

.oc-switch__track {
  position: relative;
  flex: 0 0 auto;
  width: 32px;
  height: 18px;
  border: 1px solid var(--oc-border-default);
  border-radius: 999px;
  background: var(--oc-bg-subtle);
  transition:
    background-color var(--oc-duration-fast) var(--oc-ease),
    border-color var(--oc-duration-fast) var(--oc-ease);
}

.oc-switch__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--oc-fg-muted);
  box-shadow: var(--oc-shadow-sm);
  transition:
    background-color var(--oc-duration-fast) var(--oc-ease),
    transform var(--oc-duration-fast) var(--oc-ease);
}

.oc-switch:hover .oc-switch__track {
  border-color: var(--oc-border-strong);
}

.oc-switch__input:focus-visible + .oc-switch__track {
  box-shadow: var(--oc-focus-ring);
}

.oc-switch__input:checked + .oc-switch__track {
  border-color: var(--oc-bg-accent);
  background: var(--oc-bg-accent);
}

.oc-switch__input:checked + .oc-switch__track .oc-switch__thumb {
  background: var(--oc-accent-fg);
  transform: translateX(14px);
}

.oc-switch__label {
  user-select: none;
}

.oc-switch--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .oc-switch__track,
  .oc-switch__thumb {
    transition-duration: 0.01ms;
  }
}
</style>
