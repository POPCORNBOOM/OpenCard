<!-- Standard 选项组：组合 OcButton 实现单选组语义与 roving tabindex 行为。 -->
<template>
  <div
    ref="groupRef"
    class="oc-option-group"
    :class="{ 'is-square': square }"
    role="radiogroup"
    :aria-label="ariaLabel"
    :aria-disabled="disabled ? 'true' : undefined"
    :style="groupStyle"
  >
    <OcButton
      v-for="(option, index) in options"
      :key="option.value"
      class="oc-option-group__button"
      variant="choice"
      :size="size"
      :active="modelValue === option.value"
      :title="option.label"
      :aria-label="option.label"
      :aria-checked="modelValue === option.value"
      :tabindex="getTabIndex(index, option)"
      :data-oc-option-index="index"
      :disabled="disabled || Boolean(option.disabled)"
      role="radio"
      @focus="handleOptionFocus(index)"
      @keydown="handleOptionKeydown($event, index)"
      @click="selectIndex(index)"
    >
      <slot name="option" :option="option" :active="modelValue === option.value">
        <span v-if="option.icon" class="codicon" :class="option.icon" />
        <span v-else>{{ option.shortLabel ?? option.label }}</span>
      </slot>
    </OcButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import OcButton from '../base/OcButton.vue'

type OptionGroupSize = 'sm' | 'md' | 'lg'

export interface OcOptionGroupItem {
  /** 选项值。 */
  value: string
  /** 选项完整标签。 */
  label: string
  /** 可选短标签。 */
  shortLabel?: string
  /** 可选图标类名。 */
  icon?: string
  /** 是否禁用当前选项。 */
  disabled?: boolean
}

interface OcOptionGroupProps {
  /** 当前选中值。 */
  modelValue: string
  /** 选项列表。 */
  options: readonly OcOptionGroupItem[]
  /** radiogroup 的 aria-label。 */
  ariaLabel?: string
  /** 列数。 */
  columns?: number
  /** 尺寸语义。 */
  size?: OptionGroupSize
  /** 是否禁用整组。 */
  disabled?: boolean
  /** 是否强制方形按钮。 */
  square?: boolean
}

interface OcOptionGroupEmits {
  /** 选中项变化时抛出。 */
  'update:modelValue': [value: string]
}

defineOptions({ name: 'OcOptionGroup' })

const props = withDefaults(defineProps<OcOptionGroupProps>(), {
  ariaLabel: undefined,
  columns: 1,
  size: 'md',
  disabled: false,
  square: false,
})

const emit = defineEmits<OcOptionGroupEmits>()

const groupRef = ref<HTMLElement | null>(null)
const rovingIndex = ref(-1)

const groupStyle = computed(() => ({
  '--oc-option-columns': String(props.columns),
}))

const firstEnabledIndex = computed(() =>
  props.options.findIndex((option) => !isOptionDisabled(option)),
)

const selectedEnabledIndex = computed(() =>
  props.options.findIndex((option) => (
    option.value === props.modelValue
    && !isOptionDisabled(option)
  )),
)

watch(
  () => ({
    modelValue: props.modelValue,
    disabled: props.disabled,
    optionSignature: props.options.map((option) => `${option.value}:${Boolean(option.disabled)}`).join('|'),
  }),
  syncRovingIndex,
  { immediate: true },
)

function isOptionDisabled(option: OcOptionGroupItem): boolean {
  return props.disabled || Boolean(option.disabled)
}

function isEnabledIndex(index: number): boolean {
  if (index < 0 || index >= props.options.length) {
    return false
  }

  return !isOptionDisabled(props.options[index])
}

function syncRovingIndex(): void {
  if (selectedEnabledIndex.value >= 0) {
    rovingIndex.value = selectedEnabledIndex.value
    return
  }

  if (isEnabledIndex(rovingIndex.value)) {
    return
  }

  rovingIndex.value = firstEnabledIndex.value
}

function getTabIndex(index: number, option: OcOptionGroupItem): number {
  if (isOptionDisabled(option)) {
    return -1
  }

  return rovingIndex.value === index ? 0 : -1
}

function focusOption(index: number): void {
  if (!groupRef.value) {
    return
  }

  const nextTarget = groupRef.value.querySelector<HTMLElement>(`[data-oc-option-index="${index}"]`)
  nextTarget?.focus()
}

function findNextEnabledIndex(startIndex: number, direction: 1 | -1): number {
  if (firstEnabledIndex.value < 0 || props.options.length === 0) {
    return -1
  }

  let index = startIndex
  for (let step = 0; step < props.options.length; step += 1) {
    index = (index + direction + props.options.length) % props.options.length
    if (isEnabledIndex(index)) {
      return index
    }
  }

  return -1
}

function selectIndex(index: number): void {
  if (!isEnabledIndex(index)) {
    return
  }

  rovingIndex.value = index
  const nextValue = props.options[index]?.value
  if (!nextValue || nextValue === props.modelValue) {
    return
  }

  emit('update:modelValue', nextValue)
}

function handleOptionFocus(index: number): void {
  if (!isEnabledIndex(index)) {
    return
  }

  rovingIndex.value = index
}

function handleOptionKeydown(event: KeyboardEvent, index: number): void {
  if (!isEnabledIndex(index)) {
    return
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(index, 1)
    if (nextIndex >= 0) {
      selectIndex(nextIndex)
      focusOption(nextIndex)
    }
    return
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(index, -1)
    if (nextIndex >= 0) {
      selectIndex(nextIndex)
      focusOption(nextIndex)
    }
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    const nextIndex = firstEnabledIndex.value
    if (nextIndex >= 0) {
      selectIndex(nextIndex)
      focusOption(nextIndex)
    }
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    const nextIndex = findNextEnabledIndex(0, -1)
    if (nextIndex >= 0) {
      selectIndex(nextIndex)
      focusOption(nextIndex)
    }
    return
  }

  if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault()
    selectIndex(index)
  }
}
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
