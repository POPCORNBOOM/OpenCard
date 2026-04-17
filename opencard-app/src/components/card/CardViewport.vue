<template>
  <div ref="viewportRef" class="card-viewport" :class="{ 'card-viewport-panning': isPanning }"
    @click="handleViewportClick" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp" @wheel.prevent="handleWheel">
    <div ref="stageRef" class="card-viewport-stage" :style="stageStyle">
      <CardRenderer :document="document" :transform-disabled-block-ids="transformDisabledBlockIds"
        @block-click="handleBlockClick" />
    </div>
    <div v-if="showTransformPreview" class="transform-preview-window" aria-hidden="true">
      <div class="transform-preview-title">Transform Preview</div>
      <div class="transform-preview-viewport" :style="transformPreviewViewportStyle">
        <div class="transform-preview-stage-shell" :style="transformPreviewShellStyle">
          <div class="transform-preview-stage" :style="transformPreviewStageStyle">
            <CardRenderer :document="document" />
          </div>
        </div>
      </div>
    </div>
    <div class="card-selection-layer">
      <div v-if="selectionFrame" class="selection-frame" :class="{ 'selection-frame-movable': showMoveHandle }"
        :style="selectionFrameStyle" @pointerdown="handleSelectionFramePointerDown">
        <button v-for="handle in activeHandles" :key="handle" type="button" class="selection-handle"
          :class="`selection-handle-${handle}`" :title="`Resize ${handle}`"
          @pointerdown.stop.prevent="startResize(handle)" />
      </div>
    </div>
    <div class="card-viewport-debug">
      x: {{ Math.round(panX) }}, y: {{ Math.round(panY) }}, scale: {{ scale.toFixed(2) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnchorPosition, CardDocument } from '../../entities/card/model'
import CardRenderer from './CardRenderer.vue'

type ResizeHandle = 'lt' | 'rt' | 'lb' | 'rb' | 'r' | 'b'
type ResizeMode = 'absolute' | 'flow' | 'none'
type SelectionFrame = {
  left: number
  top: number
  width: number
  height: number
}
type SelectionMeasurement = {
  frame: SelectionFrame
  parentFrame: SelectionFrame
  worldRect: SelectionFrame
  parentWorldWidth: number
  parentWorldHeight: number
}
type ResizePayload = {
  width: number
  height: number
  x?: number
  y?: number
}
type MovePayload = {
  x: number
  y: number
}
const TRANSFORM_EPSILON = 0.01
const MIN_SCALE = 0.2
const MAX_SCALE = 4
const WHEEL_ZOOM_SENSITIVITY = 0.0015
const WHEEL_LINE_HEIGHT = 16
const MAX_WHEEL_DELTA_PX = 240
const ZOOM_ANIMATION_SMOOTHING = 0.25
const ZOOM_ANIMATION_EPSILON = 0.001

const emit = defineEmits<{
  (e: 'block-click', blockId: string, event: MouseEvent): void
  (e: 'blank-click', event: MouseEvent): void
  (e: 'resize-selection', payload: ResizePayload): void
  (e: 'move-selection', payload: MovePayload): void
}>()

const props = withDefaults(defineProps<{
  document: CardDocument
  selectedBlockId?: string | null
  selectedLocationType?: 'simple-container-location' | 'flow-container-location' | null
  selectedAnchor?: AnchorPosition | null
  selectedParentBlockId?: string | null
  transformDisabledBlockIds?: string[]
}>(), {
  selectedBlockId: null,
  selectedLocationType: null,
  selectedAnchor: null,
  selectedParentBlockId: null,
  transformDisabledBlockIds: () => [],
})

const viewportRef = ref<HTMLElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const panX = ref(0)
const panY = ref(0)
const scale = ref(1)
const targetPanX = ref(0)
const targetPanY = ref(0)
const targetScale = ref(1)
const isPanning = ref(false)
const lastPointerX = ref(0)
const lastPointerY = ref(0)
const selectionFrame = ref<SelectionFrame | null>(null)
const activeHandle = ref<ResizeHandle | null>(null)
const isMovingSelection = ref(false)
const dragMeasurement = ref<SelectionMeasurement | null>(null)
const previewWorldRect = ref<SelectionFrame | null>(null)

let resizeObserver: ResizeObserver | null = null
let zoomAnimationFrame: number | null = null

const baseOffsetX = computed(() => {
  return getBaseOffsetXForScale(scale.value)
})

const baseOffsetY = computed(() => {
  return getBaseOffsetYForScale(scale.value)
})

const translateX = computed(() => baseOffsetX.value + panX.value)
const translateY = computed(() => baseOffsetY.value + panY.value)

const stageStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
}))
const transformPreviewScale = computed(() => {
  const previewWidth = 220
  const previewHeight = 150
  return Math.min(
    previewWidth / props.document.width,
    previewHeight / props.document.height,
    1,
  )
})
const transformPreviewStageStyle = computed(() => ({
  transform: `scale(${transformPreviewScale.value})`,
  width: `${props.document.width}px`,
  height: `${props.document.height}px`,
}))
const transformPreviewShellStyle = computed(() => ({
  width: `${props.document.width}px`,
  height: `${props.document.height}px`,
}))
const transformPreviewViewportStyle = computed(() => ({
  width: `${Math.round(props.document.width * transformPreviewScale.value)}px`,
  height: `${Math.round(props.document.height * transformPreviewScale.value)}px`,
}))
const showTransformPreview = computed(() => props.selectedBlockId !== null)
const resizeMode = computed<ResizeMode>(() => {
  if (!props.selectedBlockId) {
    return 'none'
  }
  return props.selectedLocationType === 'flow-container-location' ? 'flow' : 'absolute'
})
const activeHandles = computed<ResizeHandle[]>(() => {
  if (resizeMode.value === 'flow') {
    return ['r', 'b', 'rb']
  }
  if (resizeMode.value === 'absolute') {
    return ['lt', 'rt', 'lb', 'rb']
  }
  return []
})
const showMoveHandle = computed(() => props.selectedLocationType === 'simple-container-location')
const selectionFrameStyle = computed(() => {
  const frame = selectionFrame.value
  if (!frame) {
    return {}
  }
  return {
    left: `${frame.left}px`,
    top: `${frame.top}px`,
    width: `${frame.width}px`,
    height: `${frame.height}px`,
  }
})

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 1) return

  event.preventDefault()
  stopZoomAnimation()
  isPanning.value = true
  lastPointerX.value = event.clientX
  lastPointerY.value = event.clientY
}

function handleMouseMove(event: MouseEvent) {
  if (!isPanning.value) return

  const deltaX = event.clientX - lastPointerX.value
  const deltaY = event.clientY - lastPointerY.value

  panX.value += deltaX
  panY.value += deltaY
  targetPanX.value = panX.value
  targetPanY.value = panY.value

  lastPointerX.value = event.clientX
  lastPointerY.value = event.clientY
}

function handleMouseUp() {
  isPanning.value = false
}

function handleWheel(event: WheelEvent) {
  const viewport = viewportRef.value
  if (!viewport) return

  const rect = viewport.getBoundingClientRect()
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  const previousScale = targetScale.value
  const normalizedDelta = normalizeWheelDelta(event)
  if (Math.abs(normalizedDelta) < 0.01) return
  const zoomFactor = Math.exp(-normalizedDelta * WHEEL_ZOOM_SENSITIVITY)
  const nextScale = clamp(previousScale * zoomFactor, MIN_SCALE, MAX_SCALE)
  if (Math.abs(nextScale - previousScale) < 0.0001) return

  const previousTranslateX = getBaseOffsetXForScale(previousScale) + targetPanX.value
  const previousTranslateY = getBaseOffsetYForScale(previousScale) + targetPanY.value
  const worldX = (mouseX - previousTranslateX) / previousScale
  const worldY = (mouseY - previousTranslateY) / previousScale
  const nextBaseOffsetX = getBaseOffsetXForScale(nextScale)
  const nextBaseOffsetY = getBaseOffsetYForScale(nextScale)

  targetScale.value = nextScale
  targetPanX.value = mouseX - nextBaseOffsetX - worldX * nextScale
  targetPanY.value = mouseY - nextBaseOffsetY - worldY * nextScale
  startZoomAnimation()
}

function normalizeWheelDelta(event: WheelEvent): number {
  let delta = event.deltaY
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= WHEEL_LINE_HEIGHT
  } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= viewportHeight.value || window.innerHeight
  }
  return clamp(delta, -MAX_WHEEL_DELTA_PX, MAX_WHEEL_DELTA_PX)
}

function getBaseOffsetXForScale(value: number): number {
  return (viewportWidth.value - props.document.width * value) / 2
}

function getBaseOffsetYForScale(value: number): number {
  return (viewportHeight.value - props.document.height * value) / 2
}

function startZoomAnimation() {
  if (zoomAnimationFrame !== null) {
    return
  }

  const animate = () => {
    const scaleDelta = targetScale.value - scale.value
    const panXDelta = targetPanX.value - panX.value
    const panYDelta = targetPanY.value - panY.value

    if (
      Math.abs(scaleDelta) < ZOOM_ANIMATION_EPSILON &&
      Math.abs(panXDelta) < ZOOM_ANIMATION_EPSILON &&
      Math.abs(panYDelta) < ZOOM_ANIMATION_EPSILON
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

function stopZoomAnimation() {
  if (zoomAnimationFrame !== null) {
    cancelAnimationFrame(zoomAnimationFrame)
    zoomAnimationFrame = null
  }
  targetScale.value = scale.value
  targetPanX.value = panX.value
  targetPanY.value = panY.value
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function handleBlockClick(blockId: string, event: MouseEvent) {
  emit('block-click', blockId, event)
}

function handleViewportClick(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('[data-block-id]') || target.closest('.selection-frame')) {
    return
  }

  emit('blank-click', event)
}

function getElementFrame(element: Element, viewportRect: DOMRect): SelectionFrame {
  const rect = element.getBoundingClientRect()
  return {
    left: rect.left - viewportRect.left,
    top: rect.top - viewportRect.top,
    width: rect.width,
    height: rect.height,
  }
}

function measureSelection(): SelectionMeasurement | null {
  const viewport = viewportRef.value
  const stage = stageRef.value
  const selectedBlockId = props.selectedBlockId
  if (!viewport || !stage || !selectedBlockId) {
    return null
  }

  const selectedElement = stage.querySelector(`[data-block-id="${selectedBlockId}"]`)
  if (!selectedElement) {
    return null
  }

  const viewportRect = viewport.getBoundingClientRect()
  const selectedFrame = getElementFrame(selectedElement, viewportRect)

  const parentElement = props.selectedParentBlockId
    ? stage.querySelector(`[data-block-id="${props.selectedParentBlockId}"]`)
    : stage.querySelector('.card-canvas')

  if (!parentElement) {
    return null
  }

  const parentFrame = getElementFrame(parentElement, viewportRect)
  const safeScale = scale.value || 1
  return {
    frame: selectedFrame,
    parentFrame,
    worldRect: {
      left: (selectedFrame.left - parentFrame.left) / safeScale,
      top: (selectedFrame.top - parentFrame.top) / safeScale,
      width: selectedFrame.width / safeScale,
      height: selectedFrame.height / safeScale,
    },
    parentWorldWidth: parentFrame.width / safeScale,
    parentWorldHeight: parentFrame.height / safeScale,
  }
}

async function syncSelectionFrame() {
  await nextTick()
  const measurement = measureSelection()
  selectionFrame.value = measurement?.frame ?? null
}

function startResize(handle: ResizeHandle) {
  if (resizeMode.value === 'none' || isMovingSelection.value) {
    return
  }

  const measurement = measureSelection()
  if (!measurement) {
    return
  }

  activeHandle.value = handle
  isMovingSelection.value = false
  dragMeasurement.value = measurement
  previewWorldRect.value = { ...measurement.worldRect }
  selectionFrame.value = measurement.frame

  bindTransformListeners()
}

function startMove() {
  if (!showMoveHandle.value || activeHandle.value || isMovingSelection.value) {
    return
  }

  const measurement = measureSelection()
  if (!measurement) {
    return
  }

  activeHandle.value = null
  isMovingSelection.value = true
  dragMeasurement.value = measurement
  previewWorldRect.value = { ...measurement.worldRect }
  selectionFrame.value = measurement.frame

  bindTransformListeners()
}

function handleSelectionFramePointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  event.stopPropagation()
  event.preventDefault()

  const target = event.target
  if (target instanceof Element && target.closest('.selection-handle')) {
    return
  }

  if (!showMoveHandle.value) {
    return
  }

  startMove()
}

function bindTransformListeners() {
  window.addEventListener('pointermove', handleTransformMove)
  window.addEventListener('pointerup', stopTransform)
  window.addEventListener('pointercancel', stopTransform)
}

function handleTransformMove(event: PointerEvent) {
  const measurement = dragMeasurement.value
  const preview = previewWorldRect.value
  if (!measurement || !preview) {
    return
  }

  const deltaX = event.movementX / (scale.value || 1)
  const deltaY = event.movementY / (scale.value || 1)

  if (isMovingSelection.value) {
    preview.left += deltaX
    preview.top += deltaY
  } else if (activeHandle.value) {
    const minSize = 24

    switch (activeHandle.value) {
      case 'lt':
        preview.left += deltaX
        preview.top += deltaY
        preview.width -= deltaX
        preview.height -= deltaY
        break
      case 'rt':
        preview.top += deltaY
        preview.width += deltaX
        preview.height -= deltaY
        break
      case 'lb':
        preview.left += deltaX
        preview.width -= deltaX
        preview.height += deltaY
        break
      case 'rb':
        preview.width += deltaX
        preview.height += deltaY
        break
      case 'r':
        preview.width += deltaX
        break
      case 'b':
        preview.height += deltaY
        break
    }

    if (preview.width < minSize) {
      if (activeHandle.value === 'lt' || activeHandle.value === 'lb') {
        preview.left -= minSize - preview.width
      }
      preview.width = minSize
    }

    if (preview.height < minSize) {
      if (activeHandle.value === 'lt' || activeHandle.value === 'rt') {
        preview.top -= minSize - preview.height
      }
      preview.height = minSize
    }
  }

  selectionFrame.value = {
    left: measurement.parentFrame.left + preview.left * scale.value,
    top: measurement.parentFrame.top + preview.top * scale.value,
    width: preview.width * scale.value,
    height: preview.height * scale.value,
  }
}

function buildAbsoluteResizePayload(preview: SelectionFrame, measurement: SelectionMeasurement): ResizePayload {
  const anchor = props.selectedAnchor ?? 'lt'
  const horizontalAnchor = anchor[0]
  const verticalAnchor = anchor[1]
  const left = preview.left
  const top = preview.top
  const right = preview.left + preview.width
  const bottom = preview.top + preview.height

  let x = left
  if (horizontalAnchor === 'c') {
    x = left + preview.width / 2 - measurement.parentWorldWidth / 2
  } else if (horizontalAnchor === 'r') {
    x = measurement.parentWorldWidth - right
  }

  let y = top
  if (verticalAnchor === 'c') {
    y = top + preview.height / 2 - measurement.parentWorldHeight / 2
  } else if (verticalAnchor === 'b') {
    y = measurement.parentWorldHeight - bottom
  }

  return {
    width: preview.width,
    height: preview.height,
    x,
    y,
  }
}

function buildMovePayload(preview: SelectionFrame, measurement: SelectionMeasurement): MovePayload {
  const absolutePayload = buildAbsoluteResizePayload(preview, measurement)
  return {
    x: absolutePayload.x ?? 0,
    y: absolutePayload.y ?? 0,
  }
}

function hasMeaningfulResizeChange(preview: SelectionFrame, measurement: SelectionMeasurement): boolean {
  const resizePayload = buildAbsoluteResizePayload(preview, measurement)
  return (
    Math.abs(preview.width - measurement.worldRect.width) > TRANSFORM_EPSILON ||
    Math.abs(preview.height - measurement.worldRect.height) > TRANSFORM_EPSILON ||
    Math.abs((resizePayload.x ?? 0) - buildAbsoluteResizePayload(measurement.worldRect, measurement).x!) > TRANSFORM_EPSILON ||
    Math.abs((resizePayload.y ?? 0) - buildAbsoluteResizePayload(measurement.worldRect, measurement).y!) > TRANSFORM_EPSILON
  )
}

function hasMeaningfulMoveChange(preview: SelectionFrame, measurement: SelectionMeasurement): boolean {
  const movePayload = buildMovePayload(preview, measurement)
  const originalPayload = buildMovePayload(measurement.worldRect, measurement)
  return (
    Math.abs(movePayload.x - originalPayload.x) > TRANSFORM_EPSILON ||
    Math.abs(movePayload.y - originalPayload.y) > TRANSFORM_EPSILON
  )
}

function stopTransform() {
  const measurement = dragMeasurement.value
  const preview = previewWorldRect.value
  if (measurement && preview) {
    if (activeHandle.value && hasMeaningfulResizeChange(preview, measurement)) {
      const payload = resizeMode.value === 'flow'
        ? { width: preview.width, height: preview.height }
        : buildAbsoluteResizePayload(preview, measurement)
      //console.log(payload)
      emit('resize-selection', payload)
    } else if (isMovingSelection.value && hasMeaningfulMoveChange(preview, measurement)) {
      emit('move-selection', buildMovePayload(preview, measurement))
    }
  }

  activeHandle.value = null
  isMovingSelection.value = false
  dragMeasurement.value = null
  previewWorldRect.value = null
  window.removeEventListener('pointermove', handleTransformMove)
  window.removeEventListener('pointerup', stopTransform)
  window.removeEventListener('pointercancel', stopTransform)
  void syncSelectionFrame()
}

function updateViewportSize() {
  const viewport = viewportRef.value
  if (!viewport) return

  viewportWidth.value = viewport.clientWidth
  viewportHeight.value = viewport.clientHeight
}

onMounted(() => {
  updateViewportSize()

  if (viewportRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateViewportSize()
    })
    resizeObserver.observe(viewportRef.value)
  }

  void syncSelectionFrame()
})

onBeforeUnmount(() => {
  stopTransform()
  stopZoomAnimation()
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => [
    props.selectedBlockId,
    props.selectedParentBlockId,
    props.selectedLocationType,
    props.selectedAnchor,
    props.transformDisabledBlockIds.join('|'),
    scale.value,
    translateX.value,
    translateY.value,
  ],
  () => {
    if (activeHandle.value || isMovingSelection.value) {
      return
    }
    void syncSelectionFrame()
  }
)

watch(
  () => props.document,
  () => {
    if (activeHandle.value || isMovingSelection.value) {
      return
    }
    void syncSelectionFrame()
  },
  { deep: true }
)
</script>

<style scoped>
.card-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: var(--oc-bg-elevated);
  background-image: radial-gradient(circle, var(--oc-bg-grid-dot) 1px, transparent 1px);
  background-size: 18px 18px;
  background-position: 9px 9px;
  cursor: default;
}

.card-viewport-panning {
  cursor: grabbing;
}

.card-viewport-stage {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
}

.card-selection-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.transform-preview-window {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 6;
  padding: 8px;
  border: 1px solid var(--oc-border-overlay);
  border-radius: 10px;
  background: var(--oc-bg-overlay-strong);
  box-shadow: var(--oc-shadow-overlay);
  pointer-events: none;
}

.transform-preview-title {
  margin-bottom: 8px;
  color: var(--oc-accent-preview-text);
  font-size: var(--oc-label-size);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.transform-preview-viewport {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%),
    linear-gradient(45deg, var(--oc-bg-checker-preview) 25%, transparent 25%, transparent 75%, var(--oc-bg-checker-preview) 75%);
  background-position: 0 0, 6px 6px;
  background-size: 12px 12px;
  outline: 1px solid var(--oc-border-overlay-faint);
}

.transform-preview-stage-shell {
  position: absolute;
  left: 0;
  top: 0;
}

.transform-preview-stage {
  transform-origin: 0 0;
  line-height: 0;
}

.selection-frame {
  position: absolute;
  border: 2px solid var(--oc-accent-bright);
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--oc-accent-glow);
  pointer-events: none;
}

.selection-frame-movable {
  pointer-events: auto;
  cursor: move;
}

.selection-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border: 1px solid var(--oc-accent-contrast);
  border-radius: 2px;
  background: var(--oc-accent-bright);
  box-shadow: 0 0 0 1px var(--oc-handle-shadow);
  pointer-events: auto;
  padding: 0;
}

.selection-handle-lt {
  top: -6px;
  left: -6px;
  cursor: nwse-resize;
}

.selection-handle-rt {
  top: -6px;
  right: -6px;
  cursor: nesw-resize;
}

.selection-handle-lb {
  bottom: -6px;
  left: -6px;
  cursor: nesw-resize;
}

.selection-handle-rb {
  right: -6px;
  bottom: -6px;
  cursor: nwse-resize;
}

.selection-handle-r {
  top: calc(50% - 5px);
  right: -6px;
  cursor: ew-resize;
}

.selection-handle-b {
  left: calc(50% - 5px);
  bottom: -6px;
  cursor: ns-resize;
}

.card-viewport-debug {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 4px 8px;
  border: 1px solid var(--oc-border-overlay-soft);
  border-radius: 6px;
  background: var(--oc-bg-overlay-soft);
  color: var(--oc-text-overlay);
  font-size: var(--oc-label-size);
  line-height: 1.4;
  pointer-events: none;
}
</style>
