<template>
  <span ref="rootRef" class="oc-color-picker" :class="[{ 'is-open': open }, attrs.class]" :style="attrs.style">
    <button
      ref="triggerRef"
      v-bind="triggerAttrs"
      type="button"
      class="oc-color-picker__trigger"
      :class="[`oc-color-picker__trigger--${size}`, { 'is-embedded': embedded }]"
      :disabled="disabled"
      :aria-label="label"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="togglePicker"
      @keydown.esc.stop="closePicker(true, true)"
    >
      <slot name="trigger" :color="displayColor" :open="open">
        <span class="oc-color-picker__swatch" :style="{ backgroundColor: displayColor }" />
      </slot>
    </button>

    <OcFloatingLayer
      :open="open"
      :anchor="triggerRef"
      placement="bottom-start"
      :max-height="360"
      :z-index="zIndex"
      class="oc-color-picker__floating"
      :data-oc-color-owner="pickerId"
    >
      <div class="oc-color-picker__panel" role="dialog" :aria-label="label" @keydown.esc.stop.prevent="closePicker(true, true)">
        <div
          ref="saturationRef"
          class="oc-color-picker__saturation"
          :style="{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }"
          role="slider"
          tabindex="0"
          aria-label="Saturation and brightness"
          :aria-valuetext="`${Math.round(hsv.saturation * 100)}%, ${Math.round(hsv.value * 100)}%`"
          @pointerdown="startDrag('saturation', $event)"
          @keydown="handleSaturationKeydown"
        >
          <span class="oc-color-picker__cursor" :style="saturationCursorStyle" />
        </div>

        <div
          ref="hueRef"
          class="oc-color-picker__hue"
          role="slider"
          tabindex="0"
          aria-label="Hue"
          aria-valuemin="0"
          aria-valuemax="359"
          :aria-valuenow="Math.round(hsv.hue)"
          @pointerdown="startDrag('hue', $event)"
          @keydown="handleHueKeydown"
        >
          <span class="oc-color-picker__hue-cursor" :style="hueCursorStyle" />
        </div>

        <div class="oc-color-picker__value-row">
          <span class="oc-color-picker__preview" :style="{ backgroundColor: displayColor }" />
          <OcFieldInput
            class="oc-color-picker__hex"
            :value="hexDraft"
            :aria-invalid="!normalizedDraft || undefined"
            spellcheck="false"
            maxlength="7"
            mono
            @input="handleHexInput"
            @blur="commitHexDraft"
            @keydown.enter.prevent="commitHexDraft"
          />
        </div>

        <div class="oc-color-picker__presets" aria-label="Preset colors">
          <button
            v-for="preset in presetColors"
            :key="preset"
            type="button"
            class="oc-color-picker__preset"
            :class="{ 'is-selected': preset === displayColor }"
            :style="{ backgroundColor: preset }"
            :aria-label="preset"
            :title="preset"
            @click="commitColor(preset)"
          />
        </div>
      </div>
    </OcFloatingLayer>
  </span>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, useAttrs, useId, watch, type CSSProperties } from 'vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcFloatingLayer from './OcFloatingLayer.vue'
import { hexToHsv, hsvToHex, normalizeHexColor, type HsvColor } from './colorModel'

defineOptions({ name: 'OcColorPicker', inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  disabled?: boolean
  embedded?: boolean
  size?: 'sm' | 'md' | 'lg'
  zIndex?: number
  presets?: readonly string[]
}>(), {
  modelValue: '#000000',
  label: 'Choose color',
  disabled: false,
  embedded: false,
  size: 'md',
  zIndex: 2000,
  presets: () => ['#FFFFFF', '#B8B8B8', '#1F2430', '#000000', '#F14C4C', '#F59E0B', '#3FB950', '#58A6FF', '#7C6CFF', '#A855F7'],
})

const emit = defineEmits<{
  preview: [value: string]
  commit: [value: string]
  cancel: []
  'update:modelValue': [value: string]
  'open-change': [open: boolean]
}>()

const attrs = useAttrs()
const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const saturationRef = ref<HTMLElement | null>(null)
const hueRef = ref<HTMLElement | null>(null)
const open = ref(false)
const hsv = ref<HsvColor>(hexToHsv(props.modelValue) ?? { hue: 0, saturation: 0, value: 0 })
const hexDraft = ref(normalizeHexColor(props.modelValue) ?? '#000000')
const committedValue = ref(hexDraft.value)
const pickerId = `oc-color-${useId().replace(/:/g, '')}`
let dragKind: 'saturation' | 'hue' | null = null
let dragPointerId: number | null = null

const triggerAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})
const normalizedDraft = computed(() => normalizeHexColor(hexDraft.value))
const displayColor = computed(() => normalizedDraft.value ?? hsvToHex(hsv.value))
const presetColors = computed(() => props.presets.map(color => normalizeHexColor(color)).filter((color): color is string => Boolean(color)))
const saturationCursorStyle = computed<CSSProperties>(() => ({
  left: `${hsv.value.saturation * 100}%`,
  top: `${(1 - hsv.value.value) * 100}%`,
}))
const hueCursorStyle = computed<CSSProperties>(() => ({ left: `${(hsv.value.hue / 360) * 100}%` }))

watch(() => props.modelValue, value => {
  if (open.value || dragKind) return
  syncColor(value)
})

onMounted(() => document.addEventListener('pointerdown', handleDocumentPointerDown, true))
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true)
  stopDragListeners()
})

function syncColor(value: string): void {
  const normalized = normalizeHexColor(value) ?? '#000000'
  const nextHsv = hexToHsv(normalized)
  if (!nextHsv) return
  committedValue.value = normalized
  hexDraft.value = normalized
  hsv.value = nextHsv
}

function setOpen(next: boolean): void {
  if (open.value === next) return
  open.value = next
  emit('open-change', next)
}

function togglePicker(): void {
  if (props.disabled) return
  if (open.value) closePicker(false, false)
  else {
    syncColor(props.modelValue)
    setOpen(true)
  }
}

function closePicker(restoreFocus: boolean, cancelDraft: boolean): void {
  const hasUncommittedPreview = cancelDraft && displayColor.value !== committedValue.value
  if (hasUncommittedPreview) {
    syncDraft(committedValue.value, true)
    emit('cancel')
  }
  setOpen(false)
  stopDragListeners()
  if (restoreFocus) triggerRef.value?.focus()
}

function syncDraft(value: string, preview: boolean): void {
  const normalized = normalizeHexColor(value)
  const nextHsv = normalized ? hexToHsv(normalized) : null
  if (!normalized || !nextHsv) return
  hexDraft.value = normalized
  hsv.value = nextHsv
  if (preview) emit('preview', normalized)
}

function previewHsv(next: HsvColor): void {
  hsv.value = next
  hexDraft.value = hsvToHex(next)
  emit('preview', hexDraft.value)
}

function commitColor(value = displayColor.value): void {
  const normalized = normalizeHexColor(value)
  if (!normalized) return
  syncDraft(normalized, true)
  committedValue.value = normalized
  emit('update:modelValue', normalized)
  emit('commit', normalized)
}

function startDrag(kind: 'saturation' | 'hue', event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  dragKind = kind
  dragPointerId = event.pointerId
  updateFromPointer(event)
  document.addEventListener('pointermove', handlePointerMove)
  document.addEventListener('pointerup', handlePointerUp)
  document.addEventListener('pointercancel', handlePointerUp)
}

function handlePointerMove(event: PointerEvent): void {
  if (event.pointerId === dragPointerId) updateFromPointer(event)
}

function handlePointerUp(event: PointerEvent): void {
  if (event.pointerId !== dragPointerId) return
  updateFromPointer(event)
  stopDragListeners()
  commitColor()
}

function stopDragListeners(): void {
  dragKind = null
  dragPointerId = null
  document.removeEventListener('pointermove', handlePointerMove)
  document.removeEventListener('pointerup', handlePointerUp)
  document.removeEventListener('pointercancel', handlePointerUp)
}

function updateFromPointer(event: PointerEvent): void {
  const target = dragKind === 'saturation' ? saturationRef.value : hueRef.value
  if (!target || !dragKind) return
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const horizontal = clampUnit((event.clientX - rect.left) / rect.width)
  if (dragKind === 'hue') previewHsv({ ...hsv.value, hue: horizontal * 359 })
  else previewHsv({
    ...hsv.value,
    saturation: horizontal,
    value: 1 - clampUnit((event.clientY - rect.top) / rect.height),
  })
}

function handleHueKeydown(event: KeyboardEvent): void {
  const direction = event.key === 'ArrowLeft' || event.key === 'ArrowDown'
    ? -1
    : event.key === 'ArrowRight' || event.key === 'ArrowUp' ? 1 : 0
  if (!direction) return
  event.preventDefault()
  previewHsv({ ...hsv.value, hue: hsv.value.hue + direction * (event.shiftKey ? 10 : 1) })
  commitColor()
}

function handleSaturationKeydown(event: KeyboardEvent): void {
  const step = event.shiftKey ? 0.1 : 0.02
  let next = hsv.value
  if (event.key === 'ArrowLeft') next = { ...next, saturation: clampUnit(next.saturation - step) }
  else if (event.key === 'ArrowRight') next = { ...next, saturation: clampUnit(next.saturation + step) }
  else if (event.key === 'ArrowDown') next = { ...next, value: clampUnit(next.value - step) }
  else if (event.key === 'ArrowUp') next = { ...next, value: clampUnit(next.value + step) }
  else return
  event.preventDefault()
  previewHsv(next)
  commitColor()
}

function handleHexInput(event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  hexDraft.value = target.value
  const normalized = normalizeHexColor(target.value)
  if (normalized) syncDraft(normalized, true)
}

function commitHexDraft(): void {
  if (normalizedDraft.value) commitColor(normalizedDraft.value)
}

function handleDocumentPointerDown(event: PointerEvent): void {
  if (!open.value) return
  const path = event.composedPath()
  if (rootRef.value && path.includes(rootRef.value)) return
  const insideFloating = path.some(target => (
    target instanceof HTMLElement && target.dataset.ocColorOwner === pickerId
  ))
  if (!insideFloating) closePicker(false, true)
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}
</script>

<style scoped>
.oc-color-picker {
  display: inline-flex;
  min-width: 0;
}

.oc-color-picker__trigger {
  display: inline-grid;
  width: var(--oc-size-md);
  height: var(--oc-size-md);
  padding: 4px;
  place-items: center;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-input);
  color: var(--oc-fg-default);
  cursor: pointer;
}

.oc-color-picker__trigger--sm {
  width: var(--oc-size-sm);
  height: var(--oc-size-sm);
  padding: 3px;
}

.oc-color-picker__trigger--lg {
  width: var(--oc-size-lg);
  height: var(--oc-size-lg);
}

.oc-color-picker__trigger.is-embedded {
  width: 100%;
  height: 100%;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.oc-color-picker__trigger:focus-visible {
  outline: none;
  box-shadow: var(--oc-focus-ring);
}

.oc-color-picker__trigger:disabled {
  cursor: not-allowed;
  opacity: .5;
}

.oc-color-picker__swatch {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--oc-border-strong) 55%, transparent);
}
</style>

<style>
.oc-color-picker__floating {
  width: 220px;
  overflow: hidden;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
}

.oc-color-picker__panel {
  display: grid;
  gap: var(--oc-space-3);
  padding: var(--oc-space-3);
}

.oc-color-picker__saturation {
  position: relative;
  height: 132px;
  overflow: hidden;
  border-radius: var(--oc-radius-sm);
  background-image:
    linear-gradient(to top, #000, transparent),
    linear-gradient(to right, #fff, transparent);
  cursor: crosshair;
  touch-action: none;
}

.oc-color-picker__cursor,
.oc-color-picker__hue-cursor {
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -50%);
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(0 0 0 / 55%);
}

.oc-color-picker__cursor {
  width: 10px;
  height: 10px;
}

.oc-color-picker__hue {
  position: relative;
  height: 12px;
  border-radius: var(--oc-radius-full);
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: ew-resize;
  touch-action: none;
}

.oc-color-picker__hue-cursor {
  top: 50%;
  width: 8px;
  height: 16px;
  border-radius: var(--oc-radius-full);
}

.oc-color-picker__saturation:focus-visible,
.oc-color-picker__hue:focus-visible {
  outline: none;
  box-shadow: var(--oc-focus-ring);
}

.oc-color-picker__value-row {
  display: grid;
  grid-template-columns: var(--oc-size-md) minmax(0, 1fr);
  gap: var(--oc-space-2);
  align-items: center;
}

.oc-color-picker__preview {
  width: var(--oc-size-md);
  height: var(--oc-size-md);
  border-radius: var(--oc-radius-sm);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--oc-border-strong) 55%, transparent);
}

.oc-color-picker__hex[aria-invalid="true"] {
  border-color: var(--oc-danger);
}

.oc-color-picker__presets {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 3px;
}

.oc-color-picker__preset {
  aspect-ratio: 1;
  min-width: 0;
  padding: 0;
  border: 1px solid var(--oc-border-default);
  border-radius: 2px;
  cursor: pointer;
}

.oc-color-picker__preset.is-selected {
  box-shadow: 0 0 0 1px var(--oc-bg-surface), 0 0 0 2px var(--oc-accent);
}
</style>
