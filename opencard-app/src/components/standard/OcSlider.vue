<template>
  <div
    ref="trackRef"
    class="oc-slider"
    :class="[{ 'is-disabled': disabled, 'is-dragging': dragging }, attrs.class]"
    :style="attrs.style"
    role="slider"
    :tabindex="disabled ? -1 : 0"
    :aria-valuemin="min"
    :aria-valuemax="max"
    :aria-valuenow="draftValue"
    :aria-valuetext="valueText || undefined"
    :aria-disabled="disabled || undefined"
    v-bind="controlAttrs"
    @pointerdown="startDrag"
    @keydown="handleKeydown"
  >
    <span class="oc-slider__rail">
      <span class="oc-slider__fill" :style="{ width: `${percentage}%` }" />
    </span>
    <span v-if="tickMarks.length" class="oc-slider__ticks" aria-hidden="true">
      <span
        v-for="tick in tickMarks"
        :key="tick.value"
        class="oc-slider__tick"
        :class="{ 'is-filled': tick.percentage <= percentage }"
        :style="{ left: `${tick.percentage}%` }"
      />
    </span>
    <span class="oc-slider__thumb" :style="{ left: `${percentage}%` }" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useAttrs, watch } from 'vue'

defineOptions({ name: 'OcSlider', inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  ticks?: readonly number[]
  disabled?: boolean
  valueText?: string
}>(), {
  min: 0,
  max: 100,
  step: 1,
  ticks: () => [],
  disabled: false,
  valueText: '',
})

const emit = defineEmits<{
  preview: [value: number]
  'update:modelValue': [value: number]
  commit: [value: number]
}>()

const attrs = useAttrs()
const trackRef = ref<HTMLElement | null>(null)
const draftValue = ref(normalizeValue(props.modelValue))
const dragging = ref(false)
let pointerId: number | null = null

const controlAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
const validTicks = computed(() => [...new Set(props.ticks.filter(value => (
  Number.isFinite(value) && value >= props.min && value <= props.max
)))].sort((left, right) => left - right))
const percentage = computed(() => {
  if (validTicks.value.length > 1) {
    const nearestIndex = validTicks.value.reduce((closest, value, index) => (
      Math.abs(value - draftValue.value) < Math.abs(validTicks.value[closest]! - draftValue.value)
        ? index
        : closest
    ), 0)
    return nearestIndex / (validTicks.value.length - 1) * 100
  }
  const range = props.max - props.min
  return range <= 0 ? 0 : ((draftValue.value - props.min) / range) * 100
})
const tickMarks = computed(() => {
  if (validTicks.value.length <= 1) return []
  return validTicks.value.map((value, index) => ({
    value,
    percentage: index / (validTicks.value.length - 1) * 100,
  }))
})

watch(() => props.modelValue, value => {
  if (!dragging.value) draftValue.value = normalizeValue(value)
})

onBeforeUnmount(stopDrag)

function normalizeValue(value: number): number {
  const lower = Math.min(props.min, props.max)
  const upper = Math.max(props.min, props.max)
  const clamped = Math.min(upper, Math.max(lower, value))
  const step = props.step > 0 ? props.step : 1
  const stepped = props.min + Math.round((clamped - props.min) / step) * step
  const precision = Math.max(decimalPlaces(step), decimalPlaces(props.min))
  return Number(Math.min(upper, Math.max(lower, stepped)).toFixed(precision))
}

function decimalPlaces(value: number): number {
  const text = String(value)
  return text.includes('.') ? text.length - text.indexOf('.') - 1 : 0
}

function previewValue(value: number): void {
  const normalized = normalizeValue(value)
  if (normalized === draftValue.value) return
  draftValue.value = normalized
  emit('preview', normalized)
}

function commitValue(value = draftValue.value): void {
  const normalized = normalizeValue(value)
  draftValue.value = normalized
  emit('update:modelValue', normalized)
  emit('commit', normalized)
}

function startDrag(event: PointerEvent): void {
  if (props.disabled || event.button !== 0) return
  event.preventDefault()
  dragging.value = true
  pointerId = event.pointerId
  updateFromPointer(event)
  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp)
  document.addEventListener('pointercancel', handlePointerUp)
  trackRef.value?.focus()
}

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerId === pointerId) updateFromPointer(event)
}

function handlePointerUp(event: PointerEvent): void {
  if (event.pointerId !== pointerId) return
  updateFromPointer(event)
  commitValue()
  stopDrag()
}

function stopDrag(): void {
  dragging.value = false
  pointerId = null
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', handlePointerUp)
  document.removeEventListener('pointercancel', handlePointerUp)
}

function updateFromPointer(event: PointerEvent): void {
  const rect = trackRef.value?.getBoundingClientRect()
  if (!rect || rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  if (validTicks.value.length > 1) {
    const index = Math.round(ratio * (validTicks.value.length - 1))
    previewValue(validTicks.value[index]!)
    return
  }
  previewValue(props.min + ratio * (props.max - props.min))
}

function handleKeydown(event: KeyboardEvent): void {
  if (props.disabled) return
  const keyStep = props.step * (event.shiftKey ? 10 : 1)
  let next: number | null = null
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = draftValue.value - keyStep
  else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = draftValue.value + keyStep
  else if (event.key === 'PageDown') next = draftValue.value - props.step * 10
  else if (event.key === 'PageUp') next = draftValue.value + props.step * 10
  else if (event.key === 'Home') next = props.min
  else if (event.key === 'End') next = props.max
  if (next === null) return
  event.preventDefault()
  previewValue(next)
  commitValue()
}
</script>

<style scoped>
.oc-slider {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 80px;
  height: var(--oc-size-md);
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.oc-slider__rail {
  position: relative;
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: var(--oc-radius-full);
  background: var(--oc-slider-rail-background, var(--oc-border-default));
}

.oc-slider__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--oc-slider-fill-background, var(--oc-accent));
}

.oc-slider__ticks {
  position: absolute;
  inset-inline: 0;
  top: 50%;
  height: var(--oc-space-2);
  pointer-events: none;
  transform: translateY(-50%);
}

.oc-slider__tick {
  position: absolute;
  top: 50%;
  width: var(--oc-border-width);
  height: 100%;
  background: var(--oc-border-strong);
  transform: translate(-50%, -50%);
}

.oc-slider__tick.is-filled {
  background: var(--oc-accent-fg);
}

.oc-slider__thumb {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  border: 2px solid var(--oc-bg-surface);
  border-radius: 50%;
  background: var(--oc-slider-thumb-background, var(--oc-accent));
  box-shadow: 0 0 0 1px var(--oc-border-strong), var(--oc-shadow-sm);
  transform: translate(-50%, -50%);
  transition: transform var(--oc-duration-fast) var(--oc-ease);
}

.oc-slider:hover .oc-slider__thumb,
.oc-slider.is-dragging .oc-slider__thumb {
  transform: translate(-50%, -50%) scale(1.12);
}

.oc-slider:focus-visible {
  outline: none;
}

.oc-slider:focus-visible .oc-slider__thumb {
  box-shadow: 0 0 0 1px var(--oc-bg-surface), var(--oc-focus-ring);
}

.oc-slider.is-disabled {
  cursor: not-allowed;
  opacity: .5;
}
</style>
