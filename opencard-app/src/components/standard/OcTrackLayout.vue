<!-- Base 轨道布局：多区域网格容器，支持拖拽调整相邻轨道尺寸。 -->
<template>
  <div
    ref="rootRef"
    class="oc-track-layout"
    :class="[
      { 'oc-track-layout--fill': fill },
      `oc-track-layout--axis-${axis}`
    ]"
    :style="layoutStyle"
  >
    <template v-for="item in layoutItems" :key="item.key">
      <div
        v-if="item.type === 'region'"
        class="oc-track-layout__region"
        :ref="(el) => setRegionRef(item.regionIndex, el)"
      >
        <slot :name="item.slot" />
      </div>
      <div
        v-else-if="item.type === 'handle'"
        class="oc-track-layout__handle"
        :class="{ 'is-active': activeHandleIndex === item.handleIndex }"
        role="separator"
        :aria-orientation="axis === 'horizontal' ? 'vertical' : 'horizontal'"
        :aria-label="item.ariaLabel ?? `Resize ${item.beforeSlot}`"
        tabindex="0"
        @mousedown="handleResizeStart($event, item.handleIndex)"
      >
        <span class="oc-track-layout__handle-visual" aria-hidden="true" />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
export interface OcTrackRegion {
  slot: string
  size?: 'auto' | 'fill' | 'fill-2' | 'fill-3' | string
  min?: number | string
  max?: number | string
  resizable?: boolean
  resizableStart?: boolean
  resizableEnd?: boolean
  resizerAriaLabel?: string
}
</script>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  type CSSProperties,
  type ComponentPublicInstance,
} from 'vue'

type LayoutItem =
  | { type: 'region'; key: string; regionIndex: number; slot: string }
  | { type: 'handle'; key: string; handleIndex: number; beforeSlot: string; ariaLabel?: string }

type DragState = {
  handleIndex: number
  startPointer: number
  startBeforeSize: number
  totalSize: number
  beforeMin: number
  beforeMax: number
}

defineOptions({ name: 'OcTrackLayout' })

interface Props {
  axis?: 'horizontal' | 'vertical'
  regions: readonly OcTrackRegion[]
  gap?: 'none' | '1' | '2' | '3'
  fill?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  axis: 'vertical',
  gap: 'none',
  fill: false,
})

const rootRef = ref<HTMLElement | null>(null)
const regionRefs = ref<Array<HTMLElement | null>>([])
const trackSizes = ref<string[]>([])
const activeHandleIndex = ref<number | null>(null)
const dragState = ref<DragState | null>(null)

const gapMap = {
  none: '0px',
  '1': 'var(--oc-space-1)',
  '2': 'var(--oc-space-2)',
  '3': 'var(--oc-space-3)',
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

watch(
  () => props.regions,
  (regions) => {
    trackSizes.value = regions.map((region) => resolveTrackSize(region.size))
    regionRefs.value.length = regions.length
  },
  { immediate: true, deep: true }
)

const layoutItems = computed<LayoutItem[]>(() => {
  const items: LayoutItem[] = []
  props.regions.forEach((region, index) => {
    items.push({
      type: 'region',
      key: `region-${index}-${region.slot}`,
      regionIndex: index,
      slot: region.slot,
    })
    const nextRegion = props.regions[index + 1]
    if (index < props.regions.length - 1 && (region.resizable || region.resizableEnd || nextRegion?.resizableStart)) {
      items.push({
        type: 'handle',
        key: `handle-${index}`,
        handleIndex: index,
        beforeSlot: region.slot,
        ariaLabel: region.resizerAriaLabel ?? nextRegion?.resizerAriaLabel,
      })
    }
  })
  return items
})

const trackTemplate = computed(() => {
  const segments: string[] = []
  props.regions.forEach((_, index) => {
    segments.push(trackSizes.value[index] ?? resolveTrackSize(props.regions[index]?.size))
    if (index < props.regions.length - 1) {
      segments.push(gapMap[props.gap])
    }
  })
  return segments.join(' ')
})

const layoutStyle = computed<CSSProperties>(() => {
  const baseStyle: CSSProperties = {
    alignItems: 'stretch',
    justifyItems: 'stretch',
  }
  if (props.axis === 'horizontal') {
    return {
      ...baseStyle,
      gridTemplateColumns: trackTemplate.value,
      gridTemplateRows: 'minmax(0, 1fr)',
    }
  }
  return {
    ...baseStyle,
    gridTemplateRows: trackTemplate.value,
    gridTemplateColumns: 'minmax(0, 1fr)',
  }
})

function readMainAxisPointer(event: MouseEvent): number {
  return props.axis === 'horizontal' ? event.clientX : event.clientY
}

function readMainAxisSize(element: HTMLElement): number {
  const rect = element.getBoundingClientRect()
  return props.axis === 'horizontal' ? rect.width : rect.height
}

function resolveBoundSize(value: number | string | undefined, fallback: number): number {
  if (typeof value === 'number') return value
  if (!value) return fallback

  const numeric = Number.parseFloat(value)
  if (Number.isFinite(numeric) && value.endsWith('px')) return numeric

  const map: Record<string, number> = {
    'size-sm': 22,
    'size-md': 28,
    'size-lg': 36,
    'panel-sm': 160,
    'panel-md': 220,
    'panel-lg': 280,
    'panel-xl': 320,
    'panel-2xl': 420,
  }
  return map[value] ?? fallback
}

function resolveTrackSize(value: string | undefined): string {
  if (!value || value === 'auto') return 'auto'
  if (value === 'fill') return 'minmax(0, 1fr)'
  if (value === 'fill-2') return 'minmax(0, 2fr)'
  if (value === 'fill-3') return 'minmax(0, 3fr)'

  const map: Record<string, string> = {
    'size-sm': 'var(--oc-size-sm)',
    'size-md': 'var(--oc-size-md)',
    'size-lg': 'var(--oc-size-lg)',
    'panel-sm': '160px',
    'panel-md': '220px',
    'panel-lg': '280px',
    'panel-xl': '320px',
    'panel-2xl': '420px',
  }
  return map[value] ?? value
}

function resolveRegionBounds(index: number): { min: number; max: number } {
  const region = props.regions[index]
  if (!region) {
    return { min: 0, max: Number.POSITIVE_INFINITY }
  }
  const min = Math.max(0, resolveBoundSize(region.min, 0))
  const max = resolveBoundSize(region.max, Number.POSITIVE_INFINITY)
  return { min, max: Math.max(min, max) }
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
  if (event.button !== 0) return

  const rootElement = rootRef.value
  const beforeRegion = regionRefs.value[handleIndex]
  const afterRegion = regionRefs.value[handleIndex + 1]

  if (!rootElement || !beforeRegion || !afterRegion) return

  const containerSize = readMainAxisSize(rootElement)
  const beforeSize = readMainAxisSize(beforeRegion)
  const afterSize = readMainAxisSize(afterRegion)
  const totalSize = beforeSize + afterSize

  if (containerSize <= 0 || totalSize <= 0) return

  const beforeBounds = resolveRegionBounds(handleIndex)
  const afterBounds = resolveRegionBounds(handleIndex + 1)

  const beforeMin = beforeBounds.min
  const beforeMax = Math.min(beforeBounds.max, totalSize - afterBounds.min)
  const afterMin = afterBounds.min
  const afterMax = Math.min(afterBounds.max, totalSize - beforeBounds.min)

  if (!(beforeMin <= beforeMax && afterMin <= afterMax)) return

  dragState.value = {
    handleIndex,
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
  if (!currentDragState) return

  const delta = readMainAxisPointer(event) - currentDragState.startPointer
  const nextBeforeSize = clamp(
    currentDragState.startBeforeSize + delta,
    currentDragState.beforeMin,
    currentDragState.beforeMax
  )
  const nextAfterSize = currentDragState.totalSize - nextBeforeSize
  const nextSizes = [...trackSizes.value]
  nextSizes[currentDragState.handleIndex] = formatPixelSize(nextBeforeSize)
  nextSizes[currentDragState.handleIndex + 1] = formatPixelSize(nextAfterSize)
  trackSizes.value = nextSizes
}

function handleResizeEnd(): void {
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
  display: grid;
  min-width: 0;
  min-height: 0;
}

.oc-track-layout--axis-horizontal {
  align-items: stretch;
}

.oc-track-layout--axis-vertical {
  align-content: stretch;
}

.oc-track-layout--fill {
  width: 100%;
  height: 100%;
}

.oc-track-layout__region {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.oc-track-layout--axis-horizontal > .oc-track-layout__region,
.oc-track-layout--axis-horizontal > .oc-track-layout__handle {
  height: 100%;
}

.oc-track-layout--axis-vertical > .oc-track-layout__region,
.oc-track-layout--axis-vertical > .oc-track-layout__handle {
  width: 100%;
}

.oc-track-layout__handle {
  position: relative;
  cursor: col-resize;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  z-index: 2;
}

.oc-track-layout__handle-visual {
  display: inline-block;
  width: 1px;
  height: 100%;
  background: var(--oc-border-muted);
  transition: background-color 0.2s ease;
}

.oc-track-layout__handle:hover .oc-track-layout__handle-visual,
.oc-track-layout__handle.is-active .oc-track-layout__handle-visual {
  background: var(--oc-border-accent);
}

.oc-track-layout--axis-horizontal > .oc-track-layout__handle {
  width: 8px;
  margin: 0 -4px;
  cursor: col-resize;
}

.oc-track-layout--axis-vertical > .oc-track-layout__handle {
  height: 8px;
  margin: -4px 0;
  cursor: row-resize;
}

.oc-track-layout--axis-vertical .oc-track-layout__handle-visual {
  width: 100%;
  height: 1px;
}
</style>
