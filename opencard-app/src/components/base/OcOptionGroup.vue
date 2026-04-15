<template>
  <div
    class="oc-option-group"
    :class="{ 'is-square': square }"
    role="radiogroup"
    :aria-label="ariaLabel"
    :style="groupStyle"
  >
    <OcButton
      v-for="option in options"
      :key="option.value"
      class="oc-option-group__button"
      variant="choice"
      :size="size"
      :active="modelValue === option.value"
      :title="option.label"
      :aria-label="option.label"
      :aria-checked="modelValue === option.value"
      :disabled="disabled || Boolean(option.disabled)"
      role="radio"
      @click="emit('update:modelValue', option.value)"
    >
      <slot name="option" :option="option" :active="modelValue === option.value">
        <span v-if="option.icon" class="codicon" :class="option.icon" />
        <span v-else>{{ option.shortLabel ?? option.label }}</span>
      </slot>
    </OcButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcButton from './OcButton.vue'

type OptionGroupSize = 'sm' | 'md' | 'lg'

export interface OcOptionGroupItem {
  value: string
  label: string
  shortLabel?: string
  icon?: string
  disabled?: boolean
}

defineOptions({ name: 'OcOptionGroup' })

const props = withDefaults(defineProps<{
  modelValue: string
  options: readonly OcOptionGroupItem[]
  ariaLabel?: string
  columns?: number
  size?: OptionGroupSize
  disabled?: boolean
  square?: boolean
}>(), {
  ariaLabel: undefined,
  columns: 1,
  size: 'md',
  disabled: false,
  square: false,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const groupStyle = computed(() => ({
  '--oc-option-columns': String(props.columns),
}))
</script>

<style scoped>
.oc-option-group {
  display: grid;
  grid-template-columns: repeat(var(--oc-option-columns), minmax(0, 1fr));
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.oc-option-group__button {
  min-width: 0;
}

.oc-option-group.is-square .oc-option-group__button {
  aspect-ratio: 1;
  padding: 0;
}
</style>
