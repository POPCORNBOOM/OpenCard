<!-- Standard 选项组：单选按钮组，用于互斥选项切换。 -->
<script lang="ts">
import type { IconToken } from '../../shared/ui/icon/iconRegistry'

export interface OcOption {
  value: string
  label: string
  shortLabel?: string
  icon?: IconToken
}
</script>

<script setup lang="ts">
import { computed, ref, type CSSProperties } from 'vue'
import OcButton from '../base/OcButton.vue'

interface Props {
  modelValue?: string
  options: readonly OcOption[]
  size?: 'sm' | 'md' | 'lg'
  columns?: number
  disabled?: boolean
  fill?: boolean
  square?: boolean
  iconOnly?: boolean
  appearance?: 'buttons' | 'sliding-outline'
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  size: 'sm',
  disabled: false,
  fill: false,
  square: false,
  iconOnly: false,
  appearance: 'buttons',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)

defineOptions({ name: 'OcOptionGroup' })

const containerStyle = computed<CSSProperties>(() => {
  const selectionStyle = {
    '--oc-option-count': props.options.length,
    '--oc-option-index': selectedIndex.value,
  }
  if (props.columns) {
    return {
      ...selectionStyle,
      display: 'grid',
      gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
      gap: props.appearance === 'sliding-outline' ? '0' : 'var(--oc-space-1)'
    }
  }
  return {
    ...selectionStyle,
    display: 'flex',
    gap: props.appearance === 'sliding-outline' ? '0' : 'var(--oc-space-1)'
  }
})

const isSelected = (value: string) => props.modelValue === value
const selectedIndex = computed(() => {
  const index = props.options.findIndex((option) => isSelected(option.value))
  return index >= 0 ? index : 0
})

const handleSelect = (value: string) => {
  if (!props.disabled) {
    emit('update:modelValue', value)
  }
}

function handleKeydown(event: KeyboardEvent, index: number): void {
  if (props.disabled || props.options.length === 0) return

  const columnCount = props.columns ?? props.options.length
  const movement: Partial<Record<string, number>> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: props.columns ? -columnCount : -1,
    ArrowDown: props.columns ? columnCount : 1,
  }

  let nextIndex: number | null = null
  if (event.key === 'Home') nextIndex = 0
  else if (event.key === 'End') nextIndex = props.options.length - 1
  else if (movement[event.key] != null) {
    nextIndex = (index + movement[event.key]! + props.options.length) % props.options.length
  }

  if (nextIndex == null) return
  event.preventDefault()
  const nextOption = props.options[nextIndex]
  rootRef.value?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  emit('update:modelValue', nextOption.value)
}
</script>

<template>
  <div
    ref="rootRef"
    class="oc-option-group"
    :class="{
      'oc-option-group--fill': fill,
      'oc-option-group--square': square,
      'oc-option-group--icon-only': iconOnly,
      'oc-option-group--sliding-outline': appearance === 'sliding-outline',
    }"
    :style="containerStyle"
    role="radiogroup"
    :aria-disabled="disabled || undefined"
  >
    <span v-if="appearance === 'sliding-outline'" class="oc-option-group__indicator" aria-hidden="true" />
    <OcButton
      v-for="(option, index) in options"
      :key="option.value"
      :icon="option.icon"
      :size="size"
      :disabled="disabled"
      :variant="appearance === 'sliding-outline' ? 'ghost' : isSelected(option.value) ? 'solid' : 'soft'"
      :block="fill"
      :icon-only="iconOnly"
      :data-tooltip="option.label"
      :aria-label="option.label"
      role="radio"
      :aria-checked="isSelected(option.value)"
      :tabindex="index === selectedIndex ? 0 : -1"
      @click="handleSelect(option.value)"
      @keydown="handleKeydown($event, index)"
    >
      <slot name="option" :option="option" :selected="isSelected(option.value)">
        {{ option.shortLabel ?? option.label }}
      </slot>
    </OcButton>
  </div>
</template>

<style scoped>
.oc-option-group {
  position: relative;
  min-width: 0;
}

.oc-option-group__indicator {
  position: absolute;
  z-index: 0;
  inset-block: 0;
  inset-inline-start: 0;
  width: calc(100% / var(--oc-option-count));
  border: 1px solid var(--oc-border-accent);
  border-radius: var(--oc-radius-sm);
  pointer-events: none;
  transform: translateX(calc(var(--oc-option-index) * 100%));
  transition: transform var(--oc-duration-normal) var(--oc-ease);
}

.oc-option-group--sliding-outline :deep(.oc-button) {
  z-index: 1;
  background: transparent;
}

.oc-option-group--sliding-outline :deep(.oc-button[aria-checked='true']) {
  color: var(--oc-fg-accent);
}

.oc-option-group--fill {
  width: 100%;
}

.oc-option-group--fill.oc-option-group--icon-only :deep(.oc-button) {
  width: 100%;
}

.oc-option-group--square :deep(.oc-button) {
  width: 100%;
  height: auto;
  aspect-ratio: 1;
  padding: 0;
}
</style>
