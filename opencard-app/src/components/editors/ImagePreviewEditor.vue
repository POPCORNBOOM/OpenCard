<!-- Image viewport: resolves an asset source and emits keyless viewport transform changes. -->
<template>
  <div
    ref="viewportRef"
    class="image-preview-editor"
    :class="{ 'is-panning': isPanning }"
    tabindex="0"
    :aria-label="`图片预览：${fileName}`"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="stopPanning"
    @pointercancel="stopPanning"
    @dblclick="resetView"
    @wheel.prevent="handleWheel"
    @keydown="handleKeydown"
  >
    <img
      v-if="imageSrc && !loadError"
      class="image-preview-editor__image"
      :class="{ 'is-pixelated': pixelated }"
      :src="imageSrc"
      :alt="fileName"
      :style="imageStyle"
      draggable="false"
      @load="handleLoad"
      @error="handleError"
    />

    <div v-if="loadError" class="image-preview-editor__empty">
      <OcText tone="muted" size="xl">无法预览图片</OcText>
      <OcText tone="muted">{{ fileName }}</OcText>
    </div>

    <OcOverlayToolbar
      v-if="isImageReady"
      class="image-preview-editor__controls"
      label="图片预览控制"
      @pointerdown.stop
      @dblclick.stop
    >
      <OcViewportControls
        embedded
        aria-label="图片缩放控制"
        :scale-label="scaleLabel"
        @zoom-out="zoomBy(1 / ZOOM_STEP)"
        @reset="resetView"
        @zoom-in="zoomBy(ZOOM_STEP)"
      />
      <OcButton
        icon-only
        size="sm"
        icon="tool.pixelated"
        :active="pixelated"
        :aria-pressed="pixelated"
        :variant="pixelated ? 'soft' : 'ghost'"
        :aria-label="pixelatedLabel"
        :data-tooltip="pixelatedLabel"
        @click="emit('update:pixelated', !pixelated)"
      />
    </OcOverlayToolbar>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import OcButton from '../base/OcButton.vue'
import OcText from '../base/OcText.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import OcViewportControls from '../standard/OcViewportControls.vue'

type ViewportTransform = { x: number; y: number; scale: number }

const MIN_SCALE = 0.1
const MAX_SCALE = 16
const ZOOM_STEP = 1.25
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const WHEEL_LINE_HEIGHT = 16
const MAX_WHEEL_DELTA_PX = 240
const ZOOM_ANIMATION_SMOOTHING = 0.25
const ZOOM_ANIMATION_EPSILON = 0.001
const TRANSFORM_EPSILON = 0.01
const VIEWPORT_PADDING = 32
const KEYBOARD_PAN_STEP = 32

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const { resolveAssetSrc } = useProjectStore()

const viewportRef = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const naturalWidth = ref(0)
const naturalHeight = ref(0)
const loadFailed = ref(false)
const panX = ref(props.viewportTransform?.x ?? 0)
const panY = ref(props.viewportTransform?.y ?? 0)
const scale = ref(clamp(props.viewportTransform?.scale ?? 1, MIN_SCALE, MAX_SCALE))
const targetPanX = ref(panX.value)
const targetPanY = ref(panY.value)
const targetScale = ref(scale.value)
const isPanning = ref(false)
const activePointerId = ref<number | null>(null)
const lastPointerX = ref(0)
const lastPointerY = ref(0)

let resizeObserver: ResizeObserver | null = null
let zoomAnimationFrame: number | null = null
let lastEmittedTransform: ViewportTransform | null = props.viewportTransform
  ? normalizeTransform(props.viewportTransform)
  : null

const imageSrc = computed(() => resolveAssetSrc(props.filePath))
const fileName = computed(() => props.filePath.split(/[/\\]/).pop() || props.filePath)
const loadError = computed(() => !imageSrc.value || loadFailed.value)
const isImageReady = computed(() => naturalWidth.value > 0 && naturalHeight.value > 0 && !loadError.value)
const fitScale = computed(() => {
  if (!isImageReady.value || viewportWidth.value <= 0 || viewportHeight.value <= 0) return 1
  const availableWidth = Math.max(1, viewportWidth.value - VIEWPORT_PADDING)
  const availableHeight = Math.max(1, viewportHeight.value - VIEWPORT_PADDING)
  return Math.min(availableWidth / naturalWidth.value, availableHeight / naturalHeight.value)
})
const renderedScale = computed(() => fitScale.value * scale.value)
const baseOffsetX = computed(() => getBaseOffsetX(scale.value))
const baseOffsetY = computed(() => getBaseOffsetY(scale.value))
const imageStyle = computed<CSSProperties>(() => ({
  width: `${naturalWidth.value}px`,
  height: `${naturalHeight.value}px`,
  transform: `translate(${baseOffsetX.value + panX.value}px, ${baseOffsetY.value + panY.value}px) scale(${renderedScale.value})`,
}))
const scaleLabel = computed(() => `${Math.round(renderedScale.value * 100)}%`)
const pixelated = computed(() => props.pixelated ?? false)
const pixelatedLabel = computed(() => t('projectConfig.icons.pixelated'))

function normalizeTransform(value: ViewportTransform): ViewportTransform {
  return {
    x: Number.isFinite(value.x) ? value.x : 0,
    y: Number.isFinite(value.y) ? value.y : 0,
    scale: clamp(Number.isFinite(value.scale) ? value.scale : 1, MIN_SCALE, MAX_SCALE),
  }
}

function applyViewportTransform(value?: ViewportTransform): void {
  stopZoomAnimation()
  const next = normalizeTransform(value ?? { x: 0, y: 0, scale: 1 })
  panX.value = next.x
  panY.value = next.y
  scale.value = next.scale
  targetPanX.value = next.x
  targetPanY.value = next.y
  targetScale.value = next.scale
  lastEmittedTransform = next
}

function getBaseOffsetX(zoomScale: number): number {
  return (viewportWidth.value - naturalWidth.value * fitScale.value * zoomScale) / 2
}

function getBaseOffsetY(zoomScale: number): number {
  return (viewportHeight.value - naturalHeight.value * fitScale.value * zoomScale) / 2
}

function handleLoad(event: Event): void {
  const image = event.currentTarget
  if (!(image instanceof HTMLImageElement)) return
  naturalWidth.value = image.naturalWidth
  naturalHeight.value = image.naturalHeight
  loadFailed.value = false
  emit('modified', false)
}

function handleError(): void {
  naturalWidth.value = 0
  naturalHeight.value = 0
  loadFailed.value = true
  emit('modified', false)
}

function handlePointerDown(event: PointerEvent): void {
  if (!isImageReady.value || (event.button !== 0 && event.button !== 1)) return
  event.preventDefault()
  stopZoomAnimation()
  isPanning.value = true
  activePointerId.value = event.pointerId
  lastPointerX.value = event.clientX
  lastPointerY.value = event.clientY
  viewportRef.value?.setPointerCapture(event.pointerId)
}

function handlePointerMove(event: PointerEvent): void {
  if (!isPanning.value || activePointerId.value !== event.pointerId) return
  const deltaX = event.clientX - lastPointerX.value
  const deltaY = event.clientY - lastPointerY.value
  panX.value += deltaX
  panY.value += deltaY
  targetPanX.value = panX.value
  targetPanY.value = panY.value
  lastPointerX.value = event.clientX
  lastPointerY.value = event.clientY
}

function stopPanning(event?: PointerEvent): void {
  if (event && activePointerId.value !== event.pointerId) return
  if (event && viewportRef.value?.hasPointerCapture(event.pointerId)) {
    viewportRef.value.releasePointerCapture(event.pointerId)
  }
  isPanning.value = false
  activePointerId.value = null
}

function handleWheel(event: WheelEvent): void {
  if (!isImageReady.value) return
  const viewport = viewportRef.value
  if (!viewport) return
  const rect = viewport.getBoundingClientRect()
  const delta = normalizeWheelDelta(event)
  const nextScale = targetScale.value * Math.exp(-delta * WHEEL_ZOOM_SENSITIVITY)
  zoomAt(nextScale, event.clientX - rect.left, event.clientY - rect.top)
}

function normalizeWheelDelta(event: WheelEvent): number {
  let delta = event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= WHEEL_LINE_HEIGHT
  else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= viewportHeight.value || window.innerHeight
  return clamp(delta, -MAX_WHEEL_DELTA_PX, MAX_WHEEL_DELTA_PX)
}

function zoomBy(factor: number): void {
  zoomAt(
    targetScale.value * factor,
    viewportWidth.value / 2,
    viewportHeight.value / 2,
  )
}

function zoomAt(nextValue: number, viewportX: number, viewportY: number): void {
  const previousScale = targetScale.value
  const nextScale = clamp(nextValue, MIN_SCALE, MAX_SCALE)
  if (Math.abs(nextScale - previousScale) < 0.0001) return

  const previousRenderedScale = fitScale.value * previousScale
  const imageX = (viewportX - getBaseOffsetX(previousScale) - targetPanX.value) / previousRenderedScale
  const imageY = (viewportY - getBaseOffsetY(previousScale) - targetPanY.value) / previousRenderedScale
  const nextRenderedScale = fitScale.value * nextScale

  targetScale.value = nextScale
  targetPanX.value = viewportX - getBaseOffsetX(nextScale) - imageX * nextRenderedScale
  targetPanY.value = viewportY - getBaseOffsetY(nextScale) - imageY * nextRenderedScale
  startZoomAnimation()
}

function resetView(): void {
  stopZoomAnimation()
  panX.value = 0
  panY.value = 0
  scale.value = 1
  targetPanX.value = 0
  targetPanY.value = 0
  targetScale.value = 1
}

function handleKeydown(event: KeyboardEvent): void {
  if (!isImageReady.value) return
  if (event.key === '+' || event.key === '=') zoomBy(ZOOM_STEP)
  else if (event.key === '-') zoomBy(1 / ZOOM_STEP)
  else if (event.key === '0') resetView()
  else if (event.key === 'ArrowLeft') moveBy(KEYBOARD_PAN_STEP, 0)
  else if (event.key === 'ArrowRight') moveBy(-KEYBOARD_PAN_STEP, 0)
  else if (event.key === 'ArrowUp') moveBy(0, KEYBOARD_PAN_STEP)
  else if (event.key === 'ArrowDown') moveBy(0, -KEYBOARD_PAN_STEP)
  else return
  event.preventDefault()
}

function moveBy(deltaX: number, deltaY: number): void {
  stopZoomAnimation()
  panX.value += deltaX
  panY.value += deltaY
  targetPanX.value = panX.value
  targetPanY.value = panY.value
}

function startZoomAnimation(): void {
  if (zoomAnimationFrame !== null) return
  const animate = () => {
    const scaleDelta = targetScale.value - scale.value
    const panXDelta = targetPanX.value - panX.value
    const panYDelta = targetPanY.value - panY.value
    if (
      Math.abs(scaleDelta) < ZOOM_ANIMATION_EPSILON
      && Math.abs(panXDelta) < ZOOM_ANIMATION_EPSILON
      && Math.abs(panYDelta) < ZOOM_ANIMATION_EPSILON
    ) {
      scale.value = targetScale.value
      panX.value = targetPanX.value
      panY.value = targetPanY.value
      zoomAnimationFrame = null
      return
    }
    scale.value += scaleDelta * ZOOM_ANIMATION_SMOOTHING
    panX.value += panXDelta * ZOOM_ANIMATION_SMOOTHING
    panY.value += panYDelta * ZOOM_ANIMATION_SMOOTHING
    zoomAnimationFrame = requestAnimationFrame(animate)
  }
  zoomAnimationFrame = requestAnimationFrame(animate)
}

function stopZoomAnimation(): void {
  if (zoomAnimationFrame !== null) cancelAnimationFrame(zoomAnimationFrame)
  zoomAnimationFrame = null
  targetScale.value = scale.value
  targetPanX.value = panX.value
  targetPanY.value = panY.value
}

function hasSameTransform(left: ViewportTransform | null, right: ViewportTransform): boolean {
  return Boolean(left)
    && Math.abs(left!.x - right.x) < TRANSFORM_EPSILON
    && Math.abs(left!.y - right.y) < TRANSFORM_EPSILON
    && Math.abs(left!.scale - right.scale) < TRANSFORM_EPSILON
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function save(): void {
  emit('save')
}

watch(imageSrc, () => {
  loadFailed.value = false
  naturalWidth.value = 0
  naturalHeight.value = 0
  applyViewportTransform(props.viewportTransform)
})

watch(
  () => props.viewportTransform,
  (value) => {
    if (!value || hasSameTransform(value, { x: panX.value, y: panY.value, scale: scale.value })) return
    applyViewportTransform(value)
  },
  { deep: true },
)

watch(
  () => [panX.value, panY.value, scale.value] as const,
  ([x, y, zoomScale]) => {
    const next = { x, y, scale: zoomScale }
    if (hasSameTransform(lastEmittedTransform, next)) return
    lastEmittedTransform = next
    emit('update-viewport-transform', next)
  },
)

onMounted(() => {
  const viewport = viewportRef.value
  if (viewport) {
    resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return
      viewportWidth.value = entry.contentRect.width
      viewportHeight.value = entry.contentRect.height
    })
    viewportWidth.value = viewport.clientWidth
    viewportHeight.value = viewport.clientHeight
    resizeObserver.observe(viewport)
  }
  emit('modified', false)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  stopZoomAnimation()
})

defineExpose({ save, resetView })
</script>

<style scoped>
.image-preview-editor {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  outline: none;
  background-color: var(--oc-bg-raised);
  background-image: var(--oc-viewport-dot-pattern);
  background-size: var(--oc-viewport-dot-size);
  background-position: var(--oc-viewport-dot-position);
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.image-preview-editor:focus-visible {
  box-shadow: inset var(--oc-focus-ring);
}

.image-preview-editor.is-panning {
  cursor: grabbing;
}

.image-preview-editor__image {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  max-width: none;
  max-height: none;
  transform-origin: 0 0;
  pointer-events: none;
  box-shadow: var(--oc-shadow-md);
}

.image-preview-editor__image.is-pixelated {
  image-rendering: pixelated;
}

.image-preview-editor__empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-2);
}

.image-preview-editor__controls {
  position: absolute;
  left: 50%;
  bottom: var(--oc-space-4);
  transform: translateX(-50%);
}
</style>
