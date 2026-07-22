<template>
  <div ref="viewportRef" class="card-viewport" :class="{ 'card-viewport-panning': isPanning }"
    @pointerdown.self="handleViewportPointerDown" @mousedown="handleMouseDown" @mousemove="handleMouseMove"
    @mouseup="handleMouseUp" @mouseleave="handleMouseUp" @wheel.prevent="handleWheel">
    <div ref="stageRef" class="card-viewport-stage" :style="stageStyle">
      <CardFaceRenderer :face="face" :transform-disabled-block-ids="transformDisabledBlockIds"
        :clip-to-face="clipToFace"
        @block-click="handleBlockClick" />
      <aside v-if="$slots.info" class="card-viewport-info" :style="viewportInfoStyle">
        <slot name="info" />
      </aside>
      <aside v-if="$slots['left-info']" class="card-viewport-left-info" :style="viewportLeftInfoStyle"
        @pointerdown.stop.prevent="startFaceDimensionDrag('height', $event)">
        <slot name="left-info" />
      </aside>
      <aside v-if="$slots['bottom-info']" class="card-viewport-bottom-info" :style="viewportBottomInfoStyle"
        @pointerdown.stop.prevent="startFaceDimensionDrag('width', $event)">
        <slot name="bottom-info" />
      </aside>
    </div>
    <div class="card-selection-layer">
      <div v-if="selectionFrame" :key="selectedBlockId ?? 'selection'" class="selection-frame" :class="{
        'selection-frame-movable': showMoveHandle,
        'is-resizing': activeHandle,
      }"
        :style="selectionFrameStyle" @pointerdown="handleSelectionFramePointerDown">
        <button v-for="handle in activeHandles" :key="handle" type="button" class="selection-handle"
          :class="[`selection-handle-${handle}`, { 'is-active': activeHandle === handle }]" :title="`Resize ${handle}`"
          @pointerdown.stop.prevent="startResize(handle)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnchorPosition } from '../../../entities/card/model'
import CardFaceRenderer from './CardFaceRenderer.vue'
import type { RenderReadyCardFace } from '../render.types'

type ResizeHandle = 'lt' | 'rt' | 'lb' | 'rb' | 'l' | 'r' | 't' | 'b'
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
type FaceDimension = 'width' | 'height'
type ViewportTransform = {
  x: number
  y: number
  scale: number
}
const TRANSFORM_EPSILON = 0.0001
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
  (e: 'viewport-transform-change', payload: { x: number; y: number; scale: number }): void
  (e: 'viewport-size-change', payload: { width: number; height: number }): void
  (e: 'face-dimension-change', payload: { dimension: FaceDimension; value: number; final: boolean }): void
}>()

const props = withDefaults(defineProps<{
  face: RenderReadyCardFace
  clipToFace?: boolean
  restoreKey?: string
  selectedBlockId?: string | null
  selectedLocationType?: 'simple-container-location' | 'flow-container-location' | null
  selectedAnchor?: AnchorPosition | null
  selectedParentBlockId?: string | null
  transform?: ViewportTransform
  transformDisabledBlockIds?: string[]
}>(), {
  restoreKey: undefined,
  selectedBlockId: null,
  selectedLocationType: null,
  selectedAnchor: null,
  selectedParentBlockId: null,
  transform: undefined,
  transformDisabledBlockIds: () => [],
  clipToFace: false,
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
const faceDimensionDrag = ref<{
  dimension: FaceDimension
  startClientPosition: number
  startValue: number
  lastValue: number
} | null>(null)

let resizeObserver: ResizeObserver | null = null
let zoomAnimationFrame: number | null = null
let lastEmittedTransform: ViewportTransform | null = null
let pendingTransformEchoes: ViewportTransform[] = []
let previousDimensionCursor = ''

function applyViewportTransform(transform: ViewportTransform | undefined) {
  const nextTransform = transform ?? { x: 0, y: 0, scale: 1 }
  panX.value = nextTransform.x
  panY.value = nextTransform.y
  scale.value = clamp(nextTransform.scale, MIN_SCALE, MAX_SCALE)
  targetPanX.value = panX.value
  targetPanY.value = panY.value
  targetScale.value = scale.value
}

function hasSameViewportTransform(left: ViewportTransform | null, right: ViewportTransform) {
  return Boolean(left)
    && Math.abs(left!.x - right.x) < TRANSFORM_EPSILON
    && Math.abs(left!.y - right.y) < TRANSFORM_EPSILON
    && Math.abs(left!.scale - right.scale) < TRANSFORM_EPSILON
}

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
const viewportInfoStyle = computed(() => {
  const safeScale = scale.value || 1
  return {
    left: `${props.face.width + 16 / safeScale}px`,
    transform: `scale(${1 / safeScale})`,
  }
})
const viewportLeftInfoStyle = computed(() => {
  const safeScale = scale.value || 1
  return {
    left: `${-12 / safeScale}px`,
    top: `${props.face.height / 2}px`,
    transform: `translate(-100%, -50%) rotate(-90deg) scale(${1 / safeScale})`,
  }
})
const viewportBottomInfoStyle = computed(() => {
  const safeScale = scale.value || 1
  return {
    left: `${props.face.width / 2}px`,
    top: `${props.face.height + 12 / safeScale}px`,
    transform: `translateX(-50%) scale(${1 / safeScale})`,
  }
})
const resizeMode = computed<ResizeMode>(() => {
  if (!props.selectedBlockId) {
    return 'none'
  }
  return props.selectedLocationType === 'flow-container-location' ? 'flow' : 'absolute'
})
const activeHandles = computed<ResizeHandle[]>(() => {
  if (resizeMode.value === 'flow') {
    return ['l', 't', 'r', 'b', 'rb']
  }
  if (resizeMode.value === 'absolute') {
    return ['lt', 't', 'rt', 'l', 'r', 'lb', 'b', 'rb']
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
  const normalizedDelta = normalizeWheelDelta(event.deltaY, event.deltaMode)
  if (Math.abs(normalizedDelta) < 0.01) return
  const nextScale = targetScale.value * Math.exp(-normalizedDelta * WHEEL_ZOOM_SENSITIVITY)
  zoomAt(nextScale, mouseX, mouseY)
}

function zoomByWheelAt(
  deltaY: number,
  deltaMode: number,
  viewportX: number,
  viewportY: number,
): void {
  const normalizedDelta = normalizeWheelDelta(deltaY, deltaMode)
  if (Math.abs(normalizedDelta) < 0.01) return
  zoomAt(
    targetScale.value * Math.exp(-normalizedDelta * WHEEL_ZOOM_SENSITIVITY),
    viewportX,
    viewportY,
  )
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

  const previousTranslateX = getBaseOffsetXForScale(previousScale) + targetPanX.value
  const previousTranslateY = getBaseOffsetYForScale(previousScale) + targetPanY.value
  const worldX = (viewportX - previousTranslateX) / previousScale
  const worldY = (viewportY - previousTranslateY) / previousScale
  const nextBaseOffsetX = getBaseOffsetXForScale(nextScale)
  const nextBaseOffsetY = getBaseOffsetYForScale(nextScale)

  targetScale.value = nextScale
  targetPanX.value = viewportX - nextBaseOffsetX - worldX * nextScale
  targetPanY.value = viewportY - nextBaseOffsetY - worldY * nextScale
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

function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  let delta = deltaY
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
    delta *= WHEEL_LINE_HEIGHT
  } else if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
    delta *= viewportHeight.value || window.innerHeight
  }
  return clamp(delta, -MAX_WHEEL_DELTA_PX, MAX_WHEEL_DELTA_PX)
}

function getBaseOffsetXForScale(value: number): number {
  if (viewportWidth.value <= 0) {
    return 0
  }
  return (viewportWidth.value - props.face.width * value) / 2
}

function getBaseOffsetYForScale(value: number): number {
  if (viewportHeight.value <= 0) {
    return 0
  }
  return (viewportHeight.value - props.face.height * value) / 2
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

function handleViewportPointerDown(event: PointerEvent) {
  if (event.button !== 0) {
    return
  }

  const target = event.target
  if (!(target instanceof Element)) {
    return
  }

  if (target.closest('[data-block-id]') || target.closest('.selection-frame') || target.closest('.selection-handle')) {
    return
  }

  emit('blank-click', event as unknown as MouseEvent)
}

function startFaceDimensionDrag(dimension: FaceDimension, event: PointerEvent): void {
  if (event.button !== 0) return
  const startValue = dimension === 'width' ? props.face.width : props.face.height
  faceDimensionDrag.value = {
    dimension,
    startClientPosition: dimension === 'width' ? event.clientX : event.clientY,
    startValue,
    lastValue: startValue,
  }
  previousDimensionCursor = document.body.style.cursor
  document.body.style.cursor = dimension === 'width' ? 'ew-resize' : 'ns-resize'
  window.addEventListener('pointermove', handleFaceDimensionDrag)
  window.addEventListener('pointerup', stopFaceDimensionDrag)
  window.addEventListener('pointercancel', stopFaceDimensionDrag)
}

function handleFaceDimensionDrag(event: PointerEvent): void {
  const drag = faceDimensionDrag.value
  if (!drag) return
  const clientPosition = drag.dimension === 'width' ? event.clientX : event.clientY
  const directionalDelta = drag.dimension === 'width'
    ? clientPosition - drag.startClientPosition
    : drag.startClientPosition - clientPosition
  const rawValue = drag.startValue + directionalDelta / (scale.value || 1)
  const nextValue = Math.max(16, event.shiftKey
    ? Math.round(rawValue / 10) * 10
    : Math.round(rawValue))
  if (nextValue === drag.lastValue) return
  drag.lastValue = nextValue
  emit('face-dimension-change', { dimension: drag.dimension, value: nextValue, final: false })
}

function stopFaceDimensionDrag(): void {
  const drag = faceDimensionDrag.value
  faceDimensionDrag.value = null
  window.removeEventListener('pointermove', handleFaceDimensionDrag)
  window.removeEventListener('pointerup', stopFaceDimensionDrag)
  window.removeEventListener('pointercancel', stopFaceDimensionDrag)
  if (!drag) return
  document.body.style.cursor = previousDimensionCursor
  previousDimensionCursor = ''
  if (drag.lastValue === drag.startValue) return
  emit('face-dimension-change', { dimension: drag.dimension, value: drag.lastValue, final: true })
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
    const isFlowResize = resizeMode.value === 'flow'

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
      case 'l':
        if (!isFlowResize) {
          preview.left += deltaX
        }
        preview.width -= deltaX
        break
      case 'r':
        preview.width += deltaX
        break
      case 't':
        if (!isFlowResize) {
          preview.top += deltaY
        }
        preview.height -= deltaY
        break
      case 'b':
        preview.height += deltaY
        break
    }

    if (preview.width < minSize) {
      if (!isFlowResize && (activeHandle.value === 'lt' || activeHandle.value === 'lb' || activeHandle.value === 'l')) {
        preview.left -= minSize - preview.width
      }
      preview.width = minSize
    }

    if (preview.height < minSize) {
      if (!isFlowResize && (activeHandle.value === 'lt' || activeHandle.value === 'rt' || activeHandle.value === 't')) {
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

  const width = viewport.clientWidth
  const height = viewport.clientHeight
  if (width === viewportWidth.value && height === viewportHeight.value) return

  viewportWidth.value = width
  viewportHeight.value = height
  emit('viewport-size-change', { width, height })
}

watch(
  () => [panX.value, panY.value, scale.value] as const,
  ([x, y, zoomScale]) => {
    const nextTransform = {
      x,
      y,
      scale: zoomScale,
    }
    if (hasSameViewportTransform(lastEmittedTransform, nextTransform)) {
      return
    }

    lastEmittedTransform = nextTransform
    pendingTransformEchoes.push(nextTransform)
    if (pendingTransformEchoes.length > 8) {
      pendingTransformEchoes.shift()
    }
    emit('viewport-transform-change', nextTransform)
  },
)

watch(
  () => props.restoreKey,
  () => {
    pendingTransformEchoes = []
    applyViewportTransform(props.transform)
    lastEmittedTransform = {
      x: panX.value,
      y: panY.value,
      scale: scale.value,
    }
    void syncSelectionFrame()
  },
)

watch(
  () => props.transform,
  (nextTransform) => {
    const echoIndex = nextTransform
      ? pendingTransformEchoes.findIndex((candidate) => hasSameViewportTransform(candidate, nextTransform))
      : -1
    if (echoIndex >= 0) {
      pendingTransformEchoes.splice(0, echoIndex + 1)
      return
    }

    if (
      !nextTransform
      || hasSameViewportTransform({
        x: panX.value,
        y: panY.value,
        scale: scale.value,
      }, nextTransform)
    ) {
      return
    }

    pendingTransformEchoes = []
    stopZoomAnimation()
    applyViewportTransform(nextTransform)
    lastEmittedTransform = { ...nextTransform }
    void syncSelectionFrame()
  },
  { deep: true },
)

onMounted(() => {
  applyViewportTransform(props.transform)
  lastEmittedTransform = {
    x: panX.value,
    y: panY.value,
    scale: scale.value,
  }
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
  stopFaceDimensionDrag()
  stopZoomAnimation()
  resizeObserver?.disconnect()
  resizeObserver = null
})

defineExpose({ zoomBy, zoomByWheelAt, resetView })

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
  () => props.face,
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
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: hidden;
  background-color: var(--oc-bg-raised);
  background-image: radial-gradient(
    circle at center,
    color-mix(in srgb, var(--oc-fg-subtle) 38%, transparent) 1px,
    transparent 1.25px
  );
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
  pointer-events: none;
}

.card-viewport-stage :deep([data-block-id]) {
  pointer-events: auto;
}

.card-viewport-info {
  position: absolute;
  top: 0;
  width: 228px;
  transform-origin: top left;
  pointer-events: auto;
}

.card-viewport-left-info,
.card-viewport-bottom-info {
  position: absolute;
  transform-origin: center;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
}

.card-viewport-left-info {
  cursor: ns-resize;
}

.card-viewport-bottom-info {
  cursor: ew-resize;
}

.card-selection-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.selection-frame {
  position: absolute;
  border-radius: 2px;
  box-shadow: 0 0 0 1px var(--oc-accent-glow);
  pointer-events: none;
  animation: selection-frame-enter 140ms ease-out;
  transition: box-shadow 100ms ease-out;
}

.selection-frame-movable {
  pointer-events: auto;
  cursor: move;
}

.selection-frame.is-resizing {
  box-shadow: 0 0 0 1px var(--oc-accent), 0 0 0 3px var(--oc-accent-glow);
}

.selection-handle {
  box-sizing: border-box;
  position: absolute;
  width: 14px;
  height: 14px;
  border: 0;
  background: transparent;
  pointer-events: auto;
  padding: 0;
  opacity: 1;
  animation: selection-handle-enter 140ms cubic-bezier(.2, .8, .2, 1) backwards;
  transition: opacity 100ms ease-out;
}

.selection-handle::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border: 1px solid var(--oc-accent-contrast);
  border-radius: 2px;
  background: color-mix(in srgb, var(--oc-accent) 55%, transparent);
  box-shadow: 0 0 0 1px var(--oc-handle-shadow);
  transform: translate(-50%, -50%);
  transition:
    transform 120ms cubic-bezier(.2, .8, .2, 1),
    background-color 100ms ease-out,
    box-shadow 100ms ease-out;
}

.selection-handle:hover::before,
.selection-handle:focus-visible::before {
  background: color-mix(in srgb, var(--oc-accent) 75%, transparent);
  box-shadow: 0 0 0 1px var(--oc-accent-contrast), 0 0 0 3px var(--oc-accent-glow);
  transform: translate(-50%, -50%) scale(1.15);
}

.selection-handle.is-active::before {
  background: var(--oc-accent);
  box-shadow: 0 0 0 1px var(--oc-accent-contrast), 0 0 0 4px var(--oc-accent-glow);
  transform: translate(-50%, -50%) scale(1.2);
}

.selection-handle:focus-visible {
  outline: none;
}

.selection-frame.is-resizing .selection-handle:not(.is-active) {
  opacity: .35;
}

.selection-handle:nth-child(2) {
  animation-delay: 12ms;
}

.selection-handle:nth-child(3) {
  animation-delay: 24ms;
}

.selection-handle:nth-child(4) {
  animation-delay: 36ms;
}

.selection-handle:nth-child(5) {
  animation-delay: 48ms;
}

.selection-handle:nth-child(6) {
  animation-delay: 60ms;
}

.selection-handle:nth-child(7) {
  animation-delay: 72ms;
}

.selection-handle:nth-child(8) {
  animation-delay: 84ms;
}

.selection-handle-lt {
  top: -7px;
  left: -7px;
  cursor: nwse-resize;
}

.selection-handle-rt {
  top: -7px;
  right: -7px;
  cursor: nesw-resize;
}

.selection-handle-lb {
  bottom: -7px;
  left: -7px;
  cursor: nesw-resize;
}

.selection-handle-rb {
  right: -7px;
  bottom: -7px;
  cursor: nwse-resize;
}

.selection-handle-r {
  top: calc(50% - 7px);
  right: -7px;
  cursor: ew-resize;
}

.selection-handle-l {
  top: calc(50% - 7px);
  left: -7px;
  cursor: ew-resize;
}

.selection-handle-b {
  left: calc(50% - 7px);
  bottom: -7px;
  cursor: ns-resize;
}

.selection-handle-t {
  left: calc(50% - 7px);
  top: -7px;
  cursor: ns-resize;
}

.selection-handle-l::before,
.selection-handle-r::before {
  width: 5px;
  height: 12px;
}

.selection-handle-t::before,
.selection-handle-b::before {
  width: 12px;
  height: 5px;
}

@keyframes selection-frame-enter {
  from {
    opacity: 0;
  }
}

@keyframes selection-handle-enter {
  from {
    opacity: 0;
    transform: scale(.7);
  }
}

@media (prefers-reduced-motion: reduce) {
  .selection-frame,
  .selection-handle {
    animation: none;
  }

  .selection-frame,
  .selection-handle,
  .selection-handle::before {
    transition: none;
  }
}
</style>
