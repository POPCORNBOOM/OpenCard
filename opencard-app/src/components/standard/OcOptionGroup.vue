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
import { computed, ref } from 'vue'
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
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  size: 'sm',
  disabled: false,
  fill: false,
  square: false,
  iconOnly: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const rootRef = ref<HTMLElement | null>(null)

defineOptions({ name: 'OcOptionGroup' })

const containerStyle = computed(() => {
  if (props.columns) {
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${props.columns}, 1fr)`,
      gap: 'var(--oc-space-1)'
    }
  }
  return {
    display: 'flex',
    gap: 'var(--oc-space-1)'
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
    }"
    :style="containerStyle"
    role="radiogroup"
    :aria-disabled="disabled || undefined"
  >
    <OcButton
      v-for="(option, index) in options"
      :key="option.value"
      :icon="option.icon"
      :size="size"
      :disabled="disabled"
      :variant="isSelected(option.value) ? 'solid' : 'soft'"
      :block="fill"
      :icon-only="iconOnly"
      :title="option.label"
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
  min-width: 0;
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
