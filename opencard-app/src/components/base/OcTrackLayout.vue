<!-- Base 轨道布局：独立实现多轨网格与拖拽分隔条，不依赖 shared primitives。 -->
<template>
  <div ref="rootRef" class="oc-track-layout" :class="`oc-track-layout--${props.axis}`" :style="layoutStyle"
    v-bind="attrs">
    <template v-for="item in layoutItems" :key="item.key">
      <div v-if="item.type === 'region'" class="oc-track-layout__region" :data-slot="item.slot"
        :data-region-index="item.regionIndex" :ref="(el) => setRegionRef(item.regionIndex, el)">
        <slot :name="item.slot" />
      </div>
      <div v-else class="oc-track-layout__resizer-hit" :class="[
        `oc-track-layout__resizer-hit--${props.axis}`,
        { 'is-active': activeHandleIndex === item.handleIndex },
      ]" role="separator" :aria-orientation="props.axis === 'horizontal' ? 'vertical' : 'horizontal'"
        :aria-label="item.ariaLabel ?? `Resize ${item.beforeSlot}`"
        tabindex="0" @mousedown="handleResizeStart($event, item.handleIndex)">
        <span class="oc-track-layout__resizer-visual" aria-hidden="true" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 多轨道布局容器：按区域配置渲染网格并支持相邻轨道的拖拽尺寸调整。
 */
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  useAttrs,
  type CSSProperties,
  type ComponentPublicInstance,
} from 'vue'
import {
  resolveOcTrackHandleSize,
  resolveOcTrackBoundPixels,
  resolveOcTrackSizeTemplate,
  type OcTrackHandleSize,
  type OcTrackRegion,
} from '../../shared/ui/foundation/tokenRegistry'

type OcTrackLayoutAxis = 'horizontal' | 'vertical'

type RegionItem = {
  type: 'region'
  key: string
  regionIndex: number
  slot: string
}

type HandleItem = {
  type: 'handle'
  key: string
  handleIndex: number
  beforeSlot: string
  ariaLabel?: string
}

type LayoutItem = RegionItem | HandleItem

type DragState = {
  handleIndex: number
  mode: Exclude<BoundaryControlMode, null>
  startPointer: number
  startBeforeSize: number
  totalSize: number
  beforeMin: number
  beforeMax: number
}

type BoundaryControlMode = 'before' | 'after' | 'both' | null

const DEFAULT_TRACK_SIZE = resolveOcTrackSizeTemplate(undefined)

defineOptions({
  name: 'OcTrackLayout',
  inheritAttrs: false,
})

interface OcTrackLayoutProps {
  /** 主轴方向：horizontal=横向分栏，vertical=纵向分栏。 */
  axis?: OcTrackLayoutAxis
  /** 拖拽条尺寸token：sm|md|lg。 */
  handleSize?: OcTrackHandleSize
  /** 轨道区域定义数组。 */
  regions: readonly OcTrackRegion[]
}

const props = withDefaults(defineProps<OcTrackLayoutProps>(), {
  axis: 'horizontal',
  handleSize: 'md',
})

interface OcTrackLayoutEmits {
  /** 轨道拖拽过程事件，返回当前轨道与相邻轨道的新尺寸。 */
  resize: [payload: { index: number; size: string; adjacentSize: string }]
  /** 轨道拖拽结束事件，返回最终尺寸。 */
  resizeEnd: [payload: { index: number; size: string; adjacentSize: string }]
}

const emit = defineEmits<OcTrackLayoutEmits>()

const attrs = useAttrs()
const rootRef = ref<HTMLElement | null>(null)
const regionRefs = ref<Array<HTMLElement | null>>([])
const trackSizes = ref<string[]>([])
const activeHandleIndex = ref<number | null>(null)
const dragState = ref<DragState | null>(null)

function hasBoundaryHandle(beforeRegionIndex: number): boolean {
  return resolveBoundaryControlMode(beforeRegionIndex) !== null
}

function resolveBoundaryControlMode(beforeRegionIndex: number): BoundaryControlMode {
  const beforeRegion = props.regions[beforeRegionIndex]
  const afterRegion = props.regions[beforeRegionIndex + 1]
  if (!beforeRegion || !afterRegion) {
    return null
  }

  const beforeEnabled = Boolean(beforeRegion.resizableEnd)
  const afterEnabled = Boolean(afterRegion.resizableStart)
  if (beforeEnabled && afterEnabled) {
    return 'both'
  }
  if (beforeEnabled) {
    return 'before'
  }
  if (afterEnabled) {
    return 'after'
  }
  return null
}

function resolveBoundaryAriaLabel(beforeRegionIndex: number): string | undefined {
  const beforeRegion = props.regions[beforeRegionIndex]
  const afterRegion = props.regions[beforeRegionIndex + 1]
  const mode = resolveBoundaryControlMode(beforeRegionIndex)
  if (mode === 'before') {
    return beforeRegion?.resizerAriaLabel ?? afterRegion?.resizerAriaLabel
  }
  if (mode === 'after') {
    return afterRegion?.resizerAriaLabel ?? beforeRegion?.resizerAriaLabel
  }
  return beforeRegion?.resizerAriaLabel ?? afterRegion?.resizerAriaLabel
}

function setRegionRef(index: number, element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    regionRefs.value[index] = element
    return
  }

  if (element && '$el' in element) {
    const componentRoot = element.$el
    regionRefs.value[index] = componentRoot instanceof HTMLElement ? componentRoot : null
    return
  }

  regionRefs.value[index] = null
}

watch(() => props.regions, (regions) => {
  trackSizes.value = regions.map((region) => resolveOcTrackSizeTemplate(region.size))
  regionRefs.value.length = regions.length
}, {
  immediate: true,
  deep: true,
})

const layoutItems = computed<LayoutItem[]>(() => {
  const items: LayoutItem[] = []
  props.regions.forEach((region, index) => {
    items.push({
      type: 'region',
      key: `region-${index}-${region.slot}`,
      regionIndex: index,
      slot: region.slot,
    })

    if (index < props.regions.length - 1 && hasBoundaryHandle(index)) {
      items.push({
        type: 'handle',
        key: `handle-${index}`,
        handleIndex: index,
        beforeSlot: region.slot,
        ariaLabel: resolveBoundaryAriaLabel(index),
      })
    }
  })
  return items
})

const trackTemplate = computed(() => {
  const segments: string[] = []
  props.regions.forEach((_, index) => {
    segments.push(trackSizes.value[index] ?? DEFAULT_TRACK_SIZE)
    if (index < props.regions.length - 1 && hasBoundaryHandle(index)) {
      segments.push('var(--oc-track-layout-handle-size)')
    }
  })
  return segments.join(' ') || 'none'
})

const layoutStyle = computed<CSSProperties>(() => {
  const baseStyle: CSSProperties = {
    '--oc-track-layout-handle-size': resolveOcTrackHandleSize(props.handleSize),
  }

  if (props.axis === 'vertical') {
    return {
      ...baseStyle,
      gridTemplateRows: trackTemplate.value,
      gridTemplateColumns: 'minmax(0, 1fr)',
    }
  }

  return {
    ...baseStyle,
    gridTemplateColumns: trackTemplate.value,
    gridTemplateRows: 'minmax(0, 1fr)',
  }
})

function readMainAxisPointer(event: MouseEvent): number {
  return props.axis === 'horizontal' ? event.clientX : event.clientY
}

function readMainAxisSize(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return props.axis === 'horizontal' ? rect.width : rect.height
}

function readCssVariablePixels(cssVar: string, fallback: number): number {
  const root = rootRef.value
  if (!root || typeof getComputedStyle !== 'function') {
    return fallback
  }

  const rawValue = getComputedStyle(root).getPropertyValue(cssVar).trim()
  const parsed = Number.parseFloat(rawValue)
  return Number.isFinite(parsed) ? parsed : fallback
}

function resolveRegionBounds(index: number): { min: number; max: number } {
  const region = props.regions[index]
  if (!region) {
    return {
      min: 0,
      max: Number.POSITIVE_INFINITY,
    }
  }

  const min = Math.max(0, resolveOcTrackBoundPixels(region.min, 0, readCssVariablePixels))
  const rawMax = resolveOcTrackBoundPixels(region.max, Number.POSITIVE_INFINITY, readCssVariablePixels)
  const max = Number.isFinite(rawMax) ? Math.max(min, rawMax) : Number.POSITIVE_INFINITY

  return { min, max }
}

function formatPixelSize(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return `${rounded}px`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function cleanupDraggingListeners(): void {
  window.removeEventListener('mousemove', handleResizeMove)
  window.removeEventListener('mouseup', handleResizeEnd)
}

function handleResizeStart(event: MouseEvent, handleIndex: number): void {
  if (event.button !== 0) {
    return
  }

  const rootElement = rootRef.value
  const beforeRegion = regionRefs.value[handleIndex]
  const afterRegion = regionRefs.value[handleIndex + 1]

  if (!rootElement || !beforeRegion || !afterRegion) {
    return
  }

  const containerSize = readMainAxisSize(rootElement)
  const beforeSize = readMainAxisSize(beforeRegion)
  const afterSize = readMainAxisSize(afterRegion)
  const totalSize = beforeSize + afterSize

  if (containerSize <= 0 || totalSize <= 0) {
    return
  }

  const beforeBounds = resolveRegionBounds(handleIndex)
  const afterBounds = resolveRegionBounds(handleIndex + 1)
  const mode = resolveBoundaryControlMode(handleIndex)
  if (!mode) {
    return
  }

  const beforeMinByBefore = beforeBounds.min
  const beforeMaxByBefore = beforeBounds.max
  const beforeMinByAfter = totalSize - afterBounds.max
  const beforeMaxByAfter = totalSize - afterBounds.min

  let beforeMin = beforeMinByBefore
  let beforeMax = beforeMaxByBefore
  if (mode === 'after') {
    beforeMin = beforeMinByAfter
    beforeMax = beforeMaxByAfter
  }
  if (mode === 'both') {
    beforeMin = Math.max(beforeMinByBefore, beforeMinByAfter)
    beforeMax = Math.min(beforeMaxByBefore, beforeMaxByAfter)
  }
  if (!(beforeMin <= beforeMax)) {
    return
  }

  dragState.value = {
    handleIndex,
    mode,
    startPointer: readMainAxisPointer(event),
    startBeforeSize: beforeSize,
    totalSize,
    beforeMin,
    beforeMax,
  }

  activeHandleIndex.value = handleIndex
  cleanupDraggingListeners()
  window.addEventListener('mousemove', handleResizeMove)
  window.addEventListener('mouseup', handleResizeEnd)
  event.preventDefault()
}

function handleResizeMove(event: MouseEvent): void {
  const currentDragState = dragState.value
  if (!currentDragState) {
    return
  }

  const delta = readMainAxisPointer(event) - currentDragState.startPointer
  const nextBeforeSize = clamp(
    currentDragState.startBeforeSize + delta,
    currentDragState.beforeMin,
    currentDragState.beforeMax,
  )
  const nextAfterSize = currentDragState.totalSize - nextBeforeSize
  const nextSizes = [...trackSizes.value]
  if (currentDragState.mode === 'before' || currentDragState.mode === 'both') {
    nextSizes[currentDragState.handleIndex] = formatPixelSize(nextBeforeSize)
  }
  if (currentDragState.mode === 'after' || currentDragState.mode === 'both') {
    nextSizes[currentDragState.handleIndex + 1] = formatPixelSize(nextAfterSize)
  }
  trackSizes.value = nextSizes

  emit('resize', {
    index: currentDragState.handleIndex,
    size: nextSizes[currentDragState.handleIndex],
    adjacentSize: nextSizes[currentDragState.handleIndex + 1],
  })
}

function handleResizeEnd(): void {
  if (!dragState.value) {
    return
  }

  const endedDragState = dragState.value
  const sizes = trackSizes.value
  emit('resizeEnd', {
    index: endedDragState.handleIndex,
    size: sizes[endedDragState.handleIndex] ?? DEFAULT_TRACK_SIZE,
    adjacentSize: sizes[endedDragState.handleIndex + 1] ?? DEFAULT_TRACK_SIZE,
  })

  dragState.value = null
  activeHandleIndex.value = null
  cleanupDraggingListeners()
}

onBeforeUnmount(() => {
  cleanupDraggingListeners()
})
</script>

<style scoped>
.oc-track-layout {
  --oc-track-layout-handle-size: 6px;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  pointer-events: none;
}

.oc-track-layout__region {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  pointer-events: none;
}

.oc-track-layout__region :slotted(*) {
  pointer-events: auto;
}

.oc-track-layout__resizer-hit {
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  touch-action: none;
  user-select: none;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.oc-track-layout__resizer-hit--horizontal {
  cursor: col-resize;
}

.oc-track-layout__resizer-hit--vertical {
  cursor: row-resize;
}

.oc-track-layout__resizer-visual {
  display: inline-flex;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-border-subtle);
  transition:
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    opacity var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
  opacity: 0.45;
}

.oc-track-layout__resizer-hit--horizontal .oc-track-layout__resizer-visual {
  width: 2px;
  height: min(100%, 48px);
}

.oc-track-layout__resizer-hit--vertical .oc-track-layout__resizer-visual {
  width: min(100%, 48px);
  height: 2px;
}

.oc-track-layout__resizer-hit:hover .oc-track-layout__resizer-visual,
.oc-track-layout__resizer-hit.is-active .oc-track-layout__resizer-visual {
  background: var(--oc-accent);
  opacity: 0.88;
}

.oc-track-layout__resizer-hit:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}
</style>
