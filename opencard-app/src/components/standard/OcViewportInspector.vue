<template>
  <section ref="rootRef" class="oc-viewport-inspector"
    :class="{ 'is-expanded': expanded, 'is-resizing': resizeState !== null }"
    :style="rootStyle">
    <div v-if="expanded" ref="handleRef" class="oc-viewport-inspector__resizebar"
      :class="{ 'is-active': resizeState !== null }" role="separator" tabindex="0"
      aria-orientation="horizontal" :aria-label="resizeLabel"
      :aria-valuemin="minimumHeight" :aria-valuemax="maximumHeight" :aria-valuenow="actualHeight"
      @pointerdown="startResize" @pointermove="continueResize" @pointerup="finishResize"
      @pointercancel="finishResize" @keydown="handleResizeKeydown">
      <span aria-hidden="true" />
    </div>
    <OcCard fill variant="glass" :title="heading" :actions="cardActions" :collapsed="!expanded"
      @action="handleAction">
      <slot />
    </OcCard>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import OcCard, { type OcCardAction } from './OcCard.vue'

const RESIZE_KEYBOARD_STEP = 16
const TOGGLE_ACTION_KEY = 'viewport-inspector.toggle'

const props = withDefaults(defineProps<{
  heading: string
  actions?: readonly OcCardAction[]
  expanded: boolean
  height: number | null
  expandLabel: string
  collapseLabel: string
  resizeLabel: string
}>(), {
  actions: () => [],
})

const emit = defineEmits<{
  'update:expanded': [expanded: boolean]
  'update:height': [height: number]
  action: [payload: { key: string }]
  'occlusion-change': [height: number]
}>()

const rootRef = ref<HTMLElement | null>(null)
const handleRef = ref<HTMLElement | null>(null)
const actualHeight = ref(0)
const minimumHeight = ref(0)
const maximumHeight = ref(0)
const resizeState = ref<{ pointerId: number; startY: number; startHeight: number } | null>(null)
let containerObserver: ResizeObserver | null = null
let previousBodyCursor = ''
let previousBodyUserSelect = ''

const rootStyle = computed<CSSProperties>(() => (
  props.expanded && props.height !== null
    ? { '--oc-viewport-inspector-current-height': `${props.height}px` }
    : {}
))
const cardActions = computed<OcCardAction[]>(() => [
  ...props.actions,
  {
    key: TOGGLE_ACTION_KEY,
    icon: props.expanded ? 'nav.chevron-down' : 'nav.chevron-up',
    title: props.expanded ? props.collapseLabel : props.expandLabel,
  },
])

function handleAction(payload: { key: string }): void {
  if (payload.key === TOGGLE_ACTION_KEY) {
    emit('update:expanded', !props.expanded)
    return
  }
  emit('action', payload)
}

function startResize(event: PointerEvent): void {
  if (!props.expanded || event.button !== 0) return
  measureLimits()
  resizeState.value = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startHeight: actualHeight.value,
  }
  handleRef.value?.setPointerCapture(event.pointerId)
  previousBodyCursor = document.body.style.cursor
  previousBodyUserSelect = document.body.style.userSelect
  document.body.style.cursor = 'row-resize'
  document.body.style.userSelect = 'none'
  event.preventDefault()
}

function continueResize(event: PointerEvent): void {
  const state = resizeState.value
  if (!state || state.pointerId !== event.pointerId) return
  updateHeight(state.startHeight - (event.clientY - state.startY))
  event.preventDefault()
}

function finishResize(event?: PointerEvent): void {
  const state = resizeState.value
  if (!state || (event && state.pointerId !== event.pointerId)) return
  if (handleRef.value?.hasPointerCapture(state.pointerId)) handleRef.value.releasePointerCapture(state.pointerId)
  resizeState.value = null
  document.body.style.cursor = previousBodyCursor
  document.body.style.userSelect = previousBodyUserSelect
  previousBodyCursor = ''
  previousBodyUserSelect = ''
}

function handleResizeKeydown(event: KeyboardEvent): void {
  measureLimits()
  if (event.key === 'ArrowUp') updateHeight(actualHeight.value + RESIZE_KEYBOARD_STEP)
  else if (event.key === 'ArrowDown') updateHeight(actualHeight.value - RESIZE_KEYBOARD_STEP)
  else if (event.key === 'Home') updateHeight(minimumHeight.value)
  else if (event.key === 'End') updateHeight(maximumHeight.value)
  else return
  event.preventDefault()
}

function updateHeight(value: number): void {
  measureLimits()
  const next = clamp(value, minimumHeight.value, maximumHeight.value)
  actualHeight.value = next
  emit('update:height', next)
  void nextTick(reportOcclusion)
}

function measureLimits(): void {
  const root = rootRef.value
  const container = root?.parentElement
  if (!root || !container) return
  const styles = getComputedStyle(root)
  const configuredMinimum = readCssPixels(styles, '--oc-viewport-inspector-min-height')
  const visibleMinimum = readCssPixels(styles, '--oc-viewport-inspector-visible-min-height')
  const bottomInset = Math.max(0, container.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom)
  maximumHeight.value = Math.max(
    readCssPixels(styles, '--oc-size-lg'),
    container.getBoundingClientRect().height - visibleMinimum - bottomInset,
  )
  minimumHeight.value = Math.min(configuredMinimum, maximumHeight.value)
  actualHeight.value = clamp(root.getBoundingClientRect().height, minimumHeight.value, maximumHeight.value)
}

function reportOcclusion(): void {
  const root = rootRef.value
  const container = root?.parentElement
  if (!root || !container) return
  const rootRect = root.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  actualHeight.value = rootRect.height
  emit('occlusion-change', Math.max(0, containerRect.bottom - rootRect.top))
}

function handleGeometryResize(): void {
  measureLimits()
  if (props.expanded && props.height !== null && props.height > maximumHeight.value) {
    emit('update:height', maximumHeight.value)
  }
  void nextTick(reportOcclusion)
}

function readCssPixels(styles: CSSStyleDeclaration, key: string): number {
  const value = Number.parseFloat(styles.getPropertyValue(key))
  return Number.isFinite(value) ? value : 0
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

watch(() => [props.expanded, props.height], () => void nextTick(() => {
  measureLimits()
  reportOcclusion()
}))

onMounted(() => {
  measureLimits()
  reportOcclusion()
  if (typeof ResizeObserver === 'undefined' || !rootRef.value?.parentElement) return
  containerObserver = new ResizeObserver(handleGeometryResize)
  containerObserver.observe(rootRef.value.parentElement)
  containerObserver.observe(rootRef.value)
})

onBeforeUnmount(() => {
  finishResize()
  containerObserver?.disconnect()
  containerObserver = null
})
</script>

<style scoped>
.oc-viewport-inspector {
  position: absolute;
  right: var(--oc-floating-surface-gap);
  bottom: var(--oc-floating-surface-gap);
  left: var(--oc-floating-surface-gap);
  z-index: var(--oc-z-viewport-inspector);
  min-width: 0;
  max-height: calc(100% - var(--oc-viewport-inspector-visible-min-height));
  pointer-events: auto;
}

.oc-viewport-inspector.is-expanded {
  height: var(
    --oc-viewport-inspector-current-height,
    var(--oc-viewport-inspector-default-height)
  );
  min-height: min(
    var(--oc-viewport-inspector-min-height),
    calc(100% - var(--oc-viewport-inspector-visible-min-height))
  );
}

.oc-viewport-inspector__resizebar {
  position: absolute;
  top: calc(var(--oc-space-3) / -2);
  right: 0;
  left: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--oc-space-3);
  min-width: 0;
  cursor: row-resize;
  touch-action: none;
  outline: none;
}

.oc-viewport-inspector__resizebar span {
  width: var(--oc-size-md);
  height: var(--oc-space-1);
  border-radius: var(--oc-radius-full);
  background: var(--oc-border-muted);
  transition: background-color var(--oc-duration-fast) var(--oc-ease);
}

.oc-viewport-inspector__resizebar:hover span,
.oc-viewport-inspector__resizebar:focus-visible span,
.oc-viewport-inspector__resizebar.is-active span {
  background: var(--oc-border-accent);
}

.oc-viewport-inspector :deep(.oc-card) {
  min-height: 0;
}
</style>
