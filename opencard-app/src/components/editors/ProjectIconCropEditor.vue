<template>
  <div ref="viewport" class="project-icon-crop-editor" :style="viewportStyle"
    :class="{ 'is-panning': isPanning, 'project-icon-crop-editor--fill': fill }"
    @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp" @wheel.prevent="handleWheel">
    <div v-if="runtime" ref="media" class="project-icon-crop-editor__media"
      :class="{ 'is-pixelated': pixelated }" :style="mediaStyle">
      <img :src="runtime.src" :alt="alt" draggable="false" />
      <div v-if="gridVisible" class="project-icon-crop-editor__grid" aria-hidden="true">
        <span v-for="(style, index) in columnGridLines" :key="`column-${index}`"
          class="project-icon-crop-editor__grid-line project-icon-crop-editor__grid-line--column"
          :style="style" />
        <span v-for="(style, index) in rowGridLines" :key="`row-${index}`"
          class="project-icon-crop-editor__grid-line project-icon-crop-editor__grid-line--row"
          :style="style" />
      </div>
      <div v-if="icon" class="project-icon-crop-editor__selection"
        :class="{ 'is-interacting': interaction }" :style="selectionStyle"
        :aria-label="moveLabel" @pointerdown="beginInteraction('move', $event)">
        <button v-for="handle in handles" :key="handle" type="button"
          class="project-icon-crop-editor__handle" :class="`project-icon-crop-editor__handle--${handle}`"
          :aria-label="handleLabels[handle]" :data-tooltip="handleLabels[handle]"
          @pointerdown="beginInteraction(handle, $event)" />
      </div>
    </div>
    <OcOverlayToolbar v-if="runtime" class="project-icon-crop-editor__viewport-toolbar">
      <OcViewportControls embedded :scale-label="scaleLabel"
        @zoom-out="zoomOut" @reset="fitView" @zoom-in="zoomIn" />
      <OcButton icon-only size="sm" icon="tool.focus-selection"
        :disabled="!icon" :active="focusSelectionEnabled" :aria-pressed="focusSelectionEnabled"
        :variant="focusSelectionEnabled ? 'soft' : 'ghost'"
        :aria-label="focusSelectedLabel" :data-tooltip="focusSelectedLabel"
        @click="toggleFocusSelection" />
      <OcButton icon-only size="sm" icon="tool.pixelated"
        :active="pixelated" :aria-pressed="pixelated"
        :variant="pixelated ? 'soft' : 'ghost'"
        :aria-label="pixelatedLabel" :data-tooltip="pixelatedLabel"
        @click="emit('update:pixelated', !pixelated)" />
      <OcButton icon-only size="sm" :icon="gridVisible ? 'tool.grid' : 'tool.grid-off'"
        :active="gridVisible" :aria-pressed="gridVisible"
        :variant="gridVisible ? 'soft' : 'ghost'"
        :aria-label="gridLabel" :data-tooltip="gridLabel"
        @click="gridVisible = !gridVisible" />
    </OcOverlayToolbar>
    <div v-else class="project-icon-crop-editor__missing">
      <OcIcon name="file.image" tone="muted" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import type { ProjectIcon } from '../../features/workspace/model/projectIcons'
import type { ProjectIconSeriesRuntime } from '../../features/workspace/services/projectIconCatalog'
import {
  VIEWPORT_FIT_PADDING,
  VIEWPORT_MIN_SCALE,
  VIEWPORT_WHEEL_ZOOM_SENSITIVITY,
  VIEWPORT_ZOOM_ANIMATION_EPSILON,
  VIEWPORT_ZOOM_ANIMATION_SMOOTHING,
  VIEWPORT_ZOOM_STEP,
  clampViewportScale,
  normalizeViewportWheelDelta,
  resolveViewportSafeRegion,
  type ViewportInsets,
} from '../../shared/ui/viewport/viewportNavigation'
import OcIcon from '../base/OcIcon.vue'
import OcButton from '../base/OcButton.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import OcViewportControls from '../standard/OcViewportControls.vue'

export type ProjectIconCropHandle = 'lt' | 't' | 'rt' | 'r' | 'rb' | 'b' | 'lb' | 'l'
type InteractionHandle = ProjectIconCropHandle | 'move'

const props = withDefaults(defineProps<{
  runtime: ProjectIconSeriesRuntime | null
  icon: ProjectIcon | null
  alt: string
  snapToGrid?: boolean
  gridRows?: number
  gridColumns?: number
  pixelated?: boolean
  fill?: boolean
  pixelatedLabel: string
  gridLabel: string
  focusSelectedLabel: string
  moveLabel: string
  handleLabels: Readonly<Record<ProjectIconCropHandle, string>>
  viewportInsets?: ViewportInsets
}>(), {
  snapToGrid: false,
  gridRows: 1,
  gridColumns: 1,
  pixelated: false,
  fill: false,
  viewportInsets: () => ({}),
})
const emit = defineEmits<{
  'update:icon': [icon: ProjectIcon]
  'update:pixelated': [pixelated: boolean]
}>()
const handles: readonly ProjectIconCropHandle[] = ['lt', 't', 'rt', 'r', 'rb', 'b', 'lb', 'l']
const viewport = ref<HTMLElement | null>(null)
const media = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const panX = ref(0)
const panY = ref(0)
const scale = ref(1)
const targetPanX = ref(0)
const targetPanY = ref(0)
const targetScale = ref(1)
const gridVisible = ref(true)
const focusSelectionEnabled = ref(true)
const isPanning = ref(false)
let lastPointerX = 0
let lastPointerY = 0
let initialFitPending = true
let resizeObserver: ResizeObserver | null = null
let zoomAnimationFrame: number | null = null
const interaction = ref<{
  handle: InteractionHandle
  startX: number
  startY: number
  icon: ProjectIcon
} | null>(null)
const previewIcon = ref<ProjectIcon | null>(null)

const scaleLabel = computed(() => `${Math.round(scale.value * 100)}%`)
const safeViewportRegion = computed(() => resolveViewportSafeRegion(
  viewportWidth.value,
  viewportHeight.value,
  props.viewportInsets,
))
const viewportStyle = computed<CSSProperties>(() => ({
  '--oc-project-icon-viewport-inset-bottom': `${Math.max(
    0,
    viewportHeight.value - safeViewportRegion.value.top - safeViewportRegion.value.height,
  )}px`,
}))
const fitScale = computed(() => {
  const runtime = props.runtime
  if (!runtime || viewportWidth.value <= 0 || viewportHeight.value <= 0) return 1
  return Math.min(
    Math.max(1, safeViewportRegion.value.width - VIEWPORT_FIT_PADDING * 2) / runtime.imageWidth,
    Math.max(1, safeViewportRegion.value.height - VIEWPORT_FIT_PADDING * 2) / runtime.imageHeight,
  )
})
const minimumScale = computed(() => Math.min(VIEWPORT_MIN_SCALE, fitScale.value))
const mediaStyle = computed<CSSProperties>(() => {
  const runtime = props.runtime
  if (!runtime) return {}
  const baseX = (viewportWidth.value - runtime.imageWidth * scale.value) / 2
  const baseY = (viewportHeight.value - runtime.imageHeight * scale.value) / 2
  return {
    width: `${runtime.imageWidth}px`,
    height: `${runtime.imageHeight}px`,
    transform: `translate(${baseX + panX.value}px, ${baseY + panY.value}px) scale(${scale.value})`,
    '--oc-project-icon-viewport-inverse-scale': String(1 / scale.value),
  }
})

const selectionStyle = computed(() => {
  const icon = previewIcon.value ?? props.icon
  if (!props.runtime || !icon) return undefined
  return {
    left: `${icon.x / props.runtime.imageWidth * 100}%`,
    top: `${icon.y / props.runtime.imageHeight * 100}%`,
    width: `${icon.width / props.runtime.imageWidth * 100}%`,
    height: `${icon.height / props.runtime.imageHeight * 100}%`,
  }
})

function gridLineStyles(size: number, divisions: number, axis: 'left' | 'top'): CSSProperties[] {
  if (!Number.isInteger(divisions) || divisions <= 1 || size <= 0) return []
  return Array.from({ length: divisions - 1 }, (_, offset) => {
    const coordinate = Math.floor((offset + 1) * size / divisions)
    return { [axis]: `${coordinate / size * 100}%` }
  })
}

const columnGridLines = computed(() => props.runtime
  ? gridLineStyles(props.runtime.imageWidth, props.gridColumns, 'left')
  : [])
const rowGridLines = computed(() => props.runtime
  ? gridLineStyles(props.runtime.imageHeight, props.gridRows, 'top')
  : [])

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function resetTransform(): void {
  stopZoomAnimation()
  panX.value = 0
  panY.value = 0
  scale.value = 1
  targetPanX.value = 0
  targetPanY.value = 0
  targetScale.value = 1
}

function fitView(): void {
  const runtime = props.runtime
  if (!runtime || viewportWidth.value <= 0 || viewportHeight.value <= 0) return
  stopZoomAnimation()
  scale.value = clampViewportScale(fitScale.value, minimumScale.value)
  panX.value = safeViewportRegion.value.centerX - viewportWidth.value / 2
  panY.value = safeViewportRegion.value.centerY - viewportHeight.value / 2
  targetScale.value = scale.value
  targetPanX.value = panX.value
  targetPanY.value = panY.value
  initialFitPending = false
}

function focusSelected(): void {
  const runtime = props.runtime
  const icon = props.icon
  if (!runtime || !icon || viewportWidth.value <= 0 || viewportHeight.value <= 0) return
  const nextScale = clampViewportScale(Math.min(
    Math.max(1, safeViewportRegion.value.width - VIEWPORT_FIT_PADDING * 2) / icon.width,
    Math.max(1, safeViewportRegion.value.height - VIEWPORT_FIT_PADDING * 2) / icon.height,
  ), minimumScale.value)
  const baseX = (viewportWidth.value - runtime.imageWidth * nextScale) / 2
  const baseY = (viewportHeight.value - runtime.imageHeight * nextScale) / 2
  const iconCenterX = icon.x + icon.width / 2
  const iconCenterY = icon.y + icon.height / 2

  targetScale.value = nextScale
  targetPanX.value = safeViewportRegion.value.centerX - baseX - iconCenterX * nextScale
  targetPanY.value = safeViewportRegion.value.centerY - baseY - iconCenterY * nextScale
  initialFitPending = false
  startZoomAnimation()
}

function toggleFocusSelection(): void {
  focusSelectionEnabled.value = !focusSelectionEnabled.value
  if (focusSelectionEnabled.value) focusSelected()
}

function scheduleInitialFit(): void {
  void nextTick(() => {
    if (!initialFitPending || !props.runtime || viewportWidth.value <= 0 || viewportHeight.value <= 0) return
    if (props.icon && focusSelectionEnabled.value) focusSelected()
    else fitView()
  })
}

function zoomAt(nextValue: number, viewportX: number, viewportY: number): void {
  const runtime = props.runtime
  if (!runtime) return
  const previousScale = targetScale.value
  const nextScale = clampViewportScale(nextValue, minimumScale.value)
  if (Math.abs(nextScale - previousScale) < VIEWPORT_ZOOM_ANIMATION_EPSILON) return
  const previousBaseX = (viewportWidth.value - runtime.imageWidth * previousScale) / 2
  const previousBaseY = (viewportHeight.value - runtime.imageHeight * previousScale) / 2
  const worldX = (viewportX - previousBaseX - targetPanX.value) / previousScale
  const worldY = (viewportY - previousBaseY - targetPanY.value) / previousScale
  const nextBaseX = (viewportWidth.value - runtime.imageWidth * nextScale) / 2
  const nextBaseY = (viewportHeight.value - runtime.imageHeight * nextScale) / 2
  targetScale.value = nextScale
  targetPanX.value = viewportX - nextBaseX - worldX * nextScale
  targetPanY.value = viewportY - nextBaseY - worldY * nextScale
  startZoomAnimation()
}

function zoomIn(): void {
  zoomAt(targetScale.value * VIEWPORT_ZOOM_STEP,
    safeViewportRegion.value.centerX, safeViewportRegion.value.centerY)
}

function zoomOut(): void {
  zoomAt(targetScale.value / VIEWPORT_ZOOM_STEP,
    safeViewportRegion.value.centerX, safeViewportRegion.value.centerY)
}

function handleWheel(event: WheelEvent): void {
  const root = viewport.value
  if (!root) return
  const rect = root.getBoundingClientRect()
  const delta = normalizeViewportWheelDelta(
    event.deltaY,
    event.deltaMode,
    viewportHeight.value || window.innerHeight,
  )
  if (Math.abs(delta) < VIEWPORT_ZOOM_ANIMATION_EPSILON) return
  zoomAt(
    targetScale.value * Math.exp(-delta * VIEWPORT_WHEEL_ZOOM_SENSITIVITY),
    event.clientX - rect.left,
    event.clientY - rect.top,
  )
}

function handleMouseDown(event: MouseEvent): void {
  if (event.button !== 1) return
  event.preventDefault()
  stopZoomAnimation()
  isPanning.value = true
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function handleMouseMove(event: MouseEvent): void {
  if (!isPanning.value) return
  const deltaX = event.clientX - lastPointerX
  const deltaY = event.clientY - lastPointerY
  panX.value += deltaX
  panY.value += deltaY
  targetPanX.value = panX.value
  targetPanY.value = panY.value
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function handleMouseUp(): void {
  isPanning.value = false
}

function startZoomAnimation(): void {
  if (zoomAnimationFrame !== null) return
  const animate = () => {
    const scaleDelta = targetScale.value - scale.value
    const panXDelta = targetPanX.value - panX.value
    const panYDelta = targetPanY.value - panY.value
    if (Math.abs(scaleDelta) < VIEWPORT_ZOOM_ANIMATION_EPSILON
      && Math.abs(panXDelta) < VIEWPORT_ZOOM_ANIMATION_EPSILON
      && Math.abs(panYDelta) < VIEWPORT_ZOOM_ANIMATION_EPSILON) {
      scale.value = targetScale.value
      panX.value = targetPanX.value
      panY.value = targetPanY.value
      zoomAnimationFrame = null
      return
    }
    scale.value += scaleDelta * VIEWPORT_ZOOM_ANIMATION_SMOOTHING
    panX.value += panXDelta * VIEWPORT_ZOOM_ANIMATION_SMOOTHING
    panY.value += panYDelta * VIEWPORT_ZOOM_ANIMATION_SMOOTHING
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

function snapCoordinate(
  value: number,
  size: number,
  divisions: number,
  minimum: number,
  maximum: number,
): number {
  const target = clamp(value, minimum, maximum)
  let index = Math.round(target * divisions / size)
  let coordinate = Math.floor(index * size / divisions)
  while (index < divisions && coordinate < minimum) {
    index += 1
    coordinate = Math.floor(index * size / divisions)
  }
  while (index > 0 && coordinate > maximum) {
    index -= 1
    coordinate = Math.floor(index * size / divisions)
  }
  return clamp(coordinate, minimum, maximum)
}

function beginInteraction(handle: InteractionHandle, event: PointerEvent): void {
  if (event.button !== 0 || !props.icon || !props.runtime || !media.value) return
  event.preventDefault()
  event.stopPropagation()
  interaction.value = { handle, startX: event.clientX, startY: event.clientY, icon: { ...props.icon } }
  window.addEventListener('pointermove', continueInteraction)
  window.addEventListener('pointerup', endInteraction, { once: true })
  window.addEventListener('pointercancel', endInteraction, { once: true })
}

function continueInteraction(event: PointerEvent): void {
  const current = interaction.value
  const runtime = props.runtime
  const bounds = media.value?.getBoundingClientRect()
  if (!current || !runtime || !bounds?.width || !bounds.height) return
  const deltaX = Math.round((event.clientX - current.startX) * runtime.imageWidth / bounds.width)
  const deltaY = Math.round((event.clientY - current.startY) * runtime.imageHeight / bounds.height)
  const original = current.icon
  let left = original.x
  let top = original.y
  let right = original.x + original.width
  let bottom = original.y + original.height

  if (current.handle === 'move') {
    const nextLeft = original.x + deltaX
    const nextTop = original.y + deltaY
    left = props.snapToGrid
      ? snapCoordinate(nextLeft, runtime.imageWidth, props.gridColumns, 0, runtime.imageWidth - original.width)
      : clamp(nextLeft, 0, runtime.imageWidth - original.width)
    top = props.snapToGrid
      ? snapCoordinate(nextTop, runtime.imageHeight, props.gridRows, 0, runtime.imageHeight - original.height)
      : clamp(nextTop, 0, runtime.imageHeight - original.height)
    right = left + original.width
    bottom = top + original.height
  } else {
    if (current.handle.includes('l')) {
      const value = original.x + deltaX
      left = props.snapToGrid
        ? snapCoordinate(value, runtime.imageWidth, props.gridColumns, 0, right - 1)
        : clamp(value, 0, right - 1)
    }
    if (current.handle.includes('r')) {
      const value = original.x + original.width + deltaX
      right = props.snapToGrid
        ? snapCoordinate(value, runtime.imageWidth, props.gridColumns, left + 1, runtime.imageWidth)
        : clamp(value, left + 1, runtime.imageWidth)
    }
    if (current.handle.includes('t')) {
      const value = original.y + deltaY
      top = props.snapToGrid
        ? snapCoordinate(value, runtime.imageHeight, props.gridRows, 0, bottom - 1)
        : clamp(value, 0, bottom - 1)
    }
    if (current.handle.includes('b')) {
      const value = original.y + original.height + deltaY
      bottom = props.snapToGrid
        ? snapCoordinate(value, runtime.imageHeight, props.gridRows, top + 1, runtime.imageHeight)
        : clamp(value, top + 1, runtime.imageHeight)
    }
  }

  previewIcon.value = { ...original, x: left, y: top, width: right - left, height: bottom - top }
}

function endInteraction(): void {
  const committedIcon = previewIcon.value
  interaction.value = null
  previewIcon.value = null
  window.removeEventListener('pointermove', continueInteraction)
  window.removeEventListener('pointerup', endInteraction)
  window.removeEventListener('pointercancel', endInteraction)
  if (committedIcon) emit('update:icon', committedIcon)
}

watch(() => props.runtime
  ? `${props.runtime.key}\u0000${props.runtime.src}\u0000${props.runtime.imageWidth}\u0000${props.runtime.imageHeight}`
  : null, () => {
  initialFitPending = true
  resetTransform()
  scheduleInitialFit()
}, { immediate: true })

watch(() => props.runtime && props.icon
  ? `${props.runtime.key}\u0000${props.icon.iconKey}`
  : null, identity => {
  if (!identity || !focusSelectionEnabled.value) return
  focusSelected()
})

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(entries => {
    const entry = entries.find(candidate => candidate.target === viewport.value)
    if (!entry) return
    viewportWidth.value = Math.max(1, Math.round(entry.contentRect.width))
    viewportHeight.value = Math.max(1, Math.round(entry.contentRect.height))
    scheduleInitialFit()
  })
  if (viewport.value) resizeObserver.observe(viewport.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  stopZoomAnimation()
  window.removeEventListener('pointermove', continueInteraction)
  window.removeEventListener('pointerup', endInteraction)
  window.removeEventListener('pointercancel', endInteraction)
})

defineExpose({
  fitView,
  focusSelected,
  zoomIn,
  zoomOut,
  getViewportTransform: () => ({ x: panX.value, y: panY.value, scale: scale.value }),
})
</script>

<style scoped>
.project-icon-crop-editor {
  position: relative;
  height: var(--oc-project-icon-atlas-height);
  min-height: var(--oc-project-icon-atlas-height);
  overflow: hidden;
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-inset);
}

.project-icon-crop-editor--fill {
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}

.project-icon-crop-editor__media {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}

.project-icon-crop-editor__media img {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
}

.project-icon-crop-editor__media.is-pixelated img {
  image-rendering: pixelated;
}

.project-icon-crop-editor__missing {
  display: grid;
  min-height: var(--oc-project-icon-atlas-height);
  place-items: center;
}

.project-icon-crop-editor__viewport-toolbar {
  position: absolute;
  bottom: calc(var(--oc-project-icon-viewport-inset-bottom, 0px) + var(--oc-floating-surface-gap));
  left: var(--oc-floating-surface-gap);
  z-index: var(--oc-z-overlay-toolbar);
}

.project-icon-crop-editor.is-panning,
.project-icon-crop-editor.is-panning .project-icon-crop-editor__selection {
  cursor: grabbing;
}

.project-icon-crop-editor__selection {
  position: absolute;
  box-sizing: border-box;
  border: calc(var(--oc-border-width) * var(--oc-project-icon-viewport-inverse-scale, 1)) solid var(--oc-border-accent);
  background: var(--oc-bg-accent-subtle);
  cursor: move;
  touch-action: none;
  transition:
    left var(--oc-duration-normal) var(--oc-ease),
    top var(--oc-duration-normal) var(--oc-ease),
    width var(--oc-duration-normal) var(--oc-ease),
    height var(--oc-duration-normal) var(--oc-ease);
}

.project-icon-crop-editor__grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.project-icon-crop-editor__grid-line {
  position: absolute;
  background: var(--oc-accent-glow);
}

.project-icon-crop-editor__grid-line--column {
  top: 0;
  bottom: 0;
  width: calc(var(--oc-border-width) * var(--oc-project-icon-viewport-inverse-scale, 1));
}

.project-icon-crop-editor__grid-line--row {
  right: 0;
  left: 0;
  height: calc(var(--oc-border-width) * var(--oc-project-icon-viewport-inverse-scale, 1));
}

.project-icon-crop-editor__selection.is-interacting {
  transition: none;
}

.project-icon-crop-editor__handle {
  position: absolute;
  box-sizing: border-box;
  width: var(--oc-size-sm);
  height: var(--oc-size-sm);
  padding: 0;
  border: 0;
  background: transparent;
  transform: scale(var(--oc-project-icon-viewport-inverse-scale, 1));
}

.project-icon-crop-editor__handle::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--oc-space-3);
  height: var(--oc-space-3);
  border: var(--oc-border-width) solid var(--oc-accent-fg);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-accent);
  box-shadow: var(--oc-shadow-sm);
  content: '';
  transform: translate(-50%, -50%);
  transition: transform var(--oc-duration-fast) var(--oc-ease);
}

.project-icon-crop-editor__handle:hover::before,
.project-icon-crop-editor__handle:focus-visible::before {
  background: var(--oc-bg-accent-hover);
}

.project-icon-crop-editor__handle:focus-visible { outline: none; }
.project-icon-crop-editor__handle--lt { top: calc(var(--oc-size-sm) / -2); left: calc(var(--oc-size-sm) / -2); cursor: nwse-resize; }
.project-icon-crop-editor__handle--t { top: calc(var(--oc-size-sm) / -2); left: calc(50% - var(--oc-size-sm) / 2); cursor: ns-resize; }
.project-icon-crop-editor__handle--rt { top: calc(var(--oc-size-sm) / -2); right: calc(var(--oc-size-sm) / -2); cursor: nesw-resize; }
.project-icon-crop-editor__handle--r { top: calc(50% - var(--oc-size-sm) / 2); right: calc(var(--oc-size-sm) / -2); cursor: ew-resize; }
.project-icon-crop-editor__handle--rb { right: calc(var(--oc-size-sm) / -2); bottom: calc(var(--oc-size-sm) / -2); cursor: nwse-resize; }
.project-icon-crop-editor__handle--b { bottom: calc(var(--oc-size-sm) / -2); left: calc(50% - var(--oc-size-sm) / 2); cursor: ns-resize; }
.project-icon-crop-editor__handle--lb { bottom: calc(var(--oc-size-sm) / -2); left: calc(var(--oc-size-sm) / -2); cursor: nesw-resize; }
.project-icon-crop-editor__handle--l { top: calc(50% - var(--oc-size-sm) / 2); left: calc(var(--oc-size-sm) / -2); cursor: ew-resize; }

.project-icon-crop-editor__handle--t::before,
.project-icon-crop-editor__handle--b::before { width: var(--oc-space-4); height: var(--oc-space-2); }
.project-icon-crop-editor__handle--l::before,
.project-icon-crop-editor__handle--r::before { width: var(--oc-space-2); height: var(--oc-space-4); }

@media (prefers-reduced-motion: reduce) {
  .project-icon-crop-editor__selection,
  .project-icon-crop-editor__handle::before { transition: none; }
}
</style>
