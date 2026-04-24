<template>
  <component
    :is="as"
    ref="rootRef"
    class="oc-track-layout"
    :class="[
      `oc-track-layout--${props.axis}`,
      {
        'is-fill': props.fill,
      },
    ]"
    :style="layoutStyle"
    v-bind="attrs"
  >
    <template v-for="item in layoutItems" :key="item.key">
      <div
        v-if="item.type === 'region'"
        class="oc-track-layout__region"
        :data-slot="item.slot"
        :data-region-index="item.regionIndex"
        :ref="(el) => setRegionRef(item.regionIndex, el)"
      >
        <slot :name="item.slot" />
      </div>
      <div
        v-else
        class="oc-track-layout__resizer"
        :class="{
          'is-active': activeHandleIndex === item.handleIndex,
          'is-disabled': !props.interactive,
        }"
        role="separator"
        :aria-orientation="props.axis === 'horizontal' ? 'vertical' : 'horizontal'"
        :aria-label="item.ariaLabel ?? `Resize ${item.leftSlot}`"
        @mousedown="handleResizeStart($event, item.handleIndex)"
      />
    </template>
  </component>
</template>

<script setup lang="ts">
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
  OC_TRACK_BOUND_SIZE_TOKENS,
  OC_TRACK_SIZE_TOKENS,
  resolveOcTrackBoundPixels,
  resolveOcTrackSizeTemplate,
  type OcBoundSize as SharedOcBoundSize,
  type OcSize as SharedOcSize,
  type OcTrackRegion as SharedOcTrackRegion,
} from '../../shared/ui/foundation/tokenRegistry'

export type OcTrackLayoutAxis = 'horizontal' | 'vertical'
export const OC_SIZE_TOKENS = OC_TRACK_SIZE_TOKENS
export const OC_BOUND_SIZE_TOKENS = OC_TRACK_BOUND_SIZE_TOKENS
export type OcSize = SharedOcSize
export type OcBoundSize = SharedOcBoundSize
export type OcTrackRegion = SharedOcTrackRegion

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
  leftSlot: string
  ariaLabel?: string
}

type LayoutItem = RegionItem | HandleItem

type DragState = {
  handleIndex: number
  startPointer: number
  startLeftSize: number
  totalSize: number
  leftMin: number
  leftMax: number
}

const DEFAULT_TRACK_SIZE = resolveOcTrackSizeTemplate(undefined)

defineOptions({
  name: 'OcTrackLayout',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: string
  axis?: OcTrackLayoutAxis
  fill?: boolean
  interactive?: boolean
  handleSize?: string
  regions: readonly OcTrackRegion[]
}>(), {
  as: 'div',
  axis: 'horizontal',
  fill: true,
  interactive: true,
  handleSize: '6px',
})

const emit = defineEmits<{
  resize: [payload: { index: number; size: string; adjacentSize: string }]
  resizeEnd: [payload: { index: number; size: string; adjacentSize: string }]
}>()

const attrs = useAttrs()
const rootRef = ref<HTMLElement | null>(null)
const regionRefs = ref<Array<HTMLElement | null>>([])
const trackSizes = ref<string[]>([])
const activeHandleIndex = ref<number | null>(null)
const dragState = ref<DragState | null>(null)

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

    if (region.resizable && index < props.regions.length - 1) {
      items.push({
        type: 'handle',
        key: `handle-${index}`,
        handleIndex: index,
        leftSlot: region.slot,
        ariaLabel: region.resizerAriaLabel,
      })
    }
  })
  return items
})

const trackTemplate = computed(() => {
  const segments: string[] = []
  props.regions.forEach((region, index) => {
    segments.push(trackSizes.value[index] ?? DEFAULT_TRACK_SIZE)
    if (region.resizable && index < props.regions.length - 1) {
      segments.push('var(--oc-track-layout-handle-size)')
    }
  })
  return segments.join(' ') || 'none'
})

const layoutStyle = computed<CSSProperties>(() => {
  const baseStyle: CSSProperties = {
    '--oc-track-layout-handle-size': props.handleSize,
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
  if (!props.interactive || event.button !== 0) {
    return
  }

  const rootElement = rootRef.value
  const leftRegion = regionRefs.value[handleIndex]
  const rightRegion = regionRefs.value[handleIndex + 1]

  if (!rootElement || !leftRegion || !rightRegion) {
    return
  }

  const containerSize = readMainAxisSize(rootElement)
  const leftSize = readMainAxisSize(leftRegion)
  const rightSize = readMainAxisSize(rightRegion)
  const totalSize = leftSize + rightSize

  if (containerSize <= 0 || totalSize <= 0) {
    return
  }

  const leftBounds = resolveRegionBounds(handleIndex)
  const rightBounds = resolveRegionBounds(handleIndex + 1)

  const leftMin = Math.max(leftBounds.min, totalSize - rightBounds.max)
  const leftMax = Math.min(leftBounds.max, totalSize - rightBounds.min)
  if (!(leftMin <= leftMax)) {
    return
  }

  dragState.value = {
    handleIndex,
    startPointer: readMainAxisPointer(event),
    startLeftSize: leftSize,
    totalSize,
    leftMin,
    leftMax,
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
  const nextLeftSize = clamp(
    currentDragState.startLeftSize + delta,
    currentDragState.leftMin,
    currentDragState.leftMax,
  )
  const nextRightSize = currentDragState.totalSize - nextLeftSize
  const nextSizes = [...trackSizes.value]
  nextSizes[currentDragState.handleIndex] = formatPixelSize(nextLeftSize)
  nextSizes[currentDragState.handleIndex + 1] = formatPixelSize(nextRightSize)
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
  min-width: 0;
  min-height: 0;
  display: grid;
}

.oc-track-layout.is-fill {
  width: 100%;
  height: 100%;
}

.oc-track-layout__region {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.oc-track-layout__resizer {
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  touch-action: none;
  user-select: none;
}

.oc-track-layout__resizer::before {
  content: '';
  position: absolute;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-border-strong);
  transition:
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    box-shadow var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-track-layout--horizontal .oc-track-layout__resizer {
  cursor: col-resize;
}

.oc-track-layout--horizontal .oc-track-layout__resizer::before {
  top: 0;
  bottom: 0;
  left: calc(50% - 1px);
  width: 2px;
}

.oc-track-layout--vertical .oc-track-layout__resizer {
  cursor: row-resize;
}

.oc-track-layout--vertical .oc-track-layout__resizer::before {
  left: 0;
  right: 0;
  top: calc(50% - 1px);
  height: 2px;
}

.oc-track-layout__resizer:hover::before {
  background: var(--oc-bg-hover-strong);
}

.oc-track-layout__resizer.is-active::before {
  background: var(--oc-bg-accent);
  box-shadow: 0 0 0 1px var(--oc-bg-accent-soft);
}

.oc-track-layout__resizer.is-disabled {
  cursor: default;
  pointer-events: none;
}
</style>
