<template>
  <aside
    ref="dockRef"
    class="cde-overlay-dock"
    :class="`cde-overlay-dock--${props.side}`"
    :style="dockStyle"
  >
    <div ref="stackRef" class="cde-overlay-dock__stack" :style="stackStyle">
      <div ref="topPanelRef" class="cde-overlay-dock__panel cde-overlay-dock__panel--top">
        <slot name="top" />
      </div>

      <div
        v-if="canResizeStack"
        class="cde-overlay-dock__split-handle"
        :style="splitHandleStyle"
      >
        <OcResizeHandle
          :minimum="props.topMinHeight"
          :maximum="splitMaximum"
          :value="splitValue"
          :label="props.splitLabel"
          orientation="horizontal"
          direction="normal"
          @resize-start="handleSplitResizeStart"
          @resize="handleSplitResize"
          @resize-end="handleSplitResizeEnd"
          @resize-cancel="handleSplitResizeCancel"
        />
      </div>

      <div class="cde-overlay-dock__panel cde-overlay-dock__panel--bottom">
        <slot name="bottom" />
      </div>
    </div>

    <OcResizeHandle
      class="cde-overlay-dock__width-handle"
      :minimum="props.collapsedExtent"
      :maximum="props.maxExtent"
      :value="props.extent"
      :label="props.widthLabel"
      orientation="vertical"
      :direction="props.side === 'left' ? 'normal' : 'reverse'"
      @resize-start="handleWidthResizeStart"
      @resize="handleWidthResize"
      @resize-end="handleWidthResizeEnd"
      @resize-cancel="handleWidthResizeCancel"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import OcResizeHandle from '../../components/standard/OcResizeHandle.vue'
import {
  resolveCdeOverlayDockGeometry,
  settleCdeOverlayExtent,
  type CdeOverlayGeometryConfig,
  type CdeOverlaySide,
} from './cdeOverlayGeometry'
import type { OcResizeHandleChange } from '../../components/standard/OcResizeHandle.vue'

defineOptions({ name: 'CdeOverlayDock' })

const props = withDefaults(defineProps<{
  side: CdeOverlaySide
  extent: number
  collapsedExtent: number
  minExtent: number
  maxExtent: number
  expandDragThreshold: number
  collapseDragThreshold: number
  floatingGap: number
  topExpanded: boolean
  bottomExpanded: boolean
  topSize: number | null
  topMinHeight: number
  bottomMinHeight: number
  splitGap: number
  responsiveMinStageWidth: number
  widthLabel: string
  splitLabel: string
}>(), {
  topSize: null,
})

const emit = defineEmits<{
  'update:extent': [value: number]
  'update:top-size': [value: number]
  'resize-start': [axis: 'width' | 'split']
  'resize-end': [axis: 'width' | 'split']
}>()

const dockRef = ref<HTMLElement | null>(null)
const stackRef = ref<HTMLElement | null>(null)
const topPanelRef = ref<HTMLElement | null>(null)
const measuredTopSize = ref(0)
const measuredStackHeight = ref(0)
const isResizing = ref(false)
const widthStartExtent = ref(props.extent)
const widthCurrentExtent = ref(props.extent)
const splitValue = ref(props.topSize ?? props.topMinHeight)
const splitStartValue = ref(props.topSize ?? props.topMinHeight)
let resizeObserver: ResizeObserver | null = null

const geometryConfig = computed<CdeOverlayGeometryConfig>(() => ({
  collapsedExtent: props.collapsedExtent,
  minExtent: props.minExtent,
  maxExtent: props.maxExtent,
  expandDragThreshold: props.expandDragThreshold,
  collapseDragThreshold: props.collapseDragThreshold,
  floatingGap: props.floatingGap,
}))
const geometry = computed(() => resolveCdeOverlayDockGeometry(
  props.side,
  props.extent,
  geometryConfig.value,
))
const hasExpandedPanel = computed(() => props.topExpanded || props.bottomExpanded)
const canResizeStack = computed(() => props.topExpanded && props.bottomExpanded)
const splitMaximum = computed(() => {
  return Math.max(
    props.topMinHeight,
    measuredStackHeight.value - props.bottomMinHeight - props.splitGap,
  )
})
const resolvedTopSize = computed(() => {
  const source = (props.topSize ?? measuredTopSize.value) || props.topMinHeight
  return clamp(source, props.topMinHeight, splitMaximum.value)
})
const dockStyle = computed<CSSProperties>(() => ({
  width: `${geometry.value.contentWidth}px`,
  transform: `translateX(${geometry.value.translationX}px)`,
  top: props.floatingGap,
  bottom: hasExpandedPanel.value ? `${props.floatingGap}px` : 'auto',
  height: hasExpandedPanel.value ? `calc(100% - ${props.floatingGap * 2}px)` : 'auto',
}))
const stackStyle = computed<CSSProperties>(() => {
  if (!props.topExpanded && !props.bottomExpanded) {
    return { gridTemplateRows: 'auto auto' }
  }
  if (!props.topExpanded) return { gridTemplateRows: 'auto minmax(0, 1fr)' }
  if (!props.bottomExpanded) return { gridTemplateRows: 'minmax(0, 1fr) auto' }
  if (props.topSize === null) {
    return { gridTemplateRows: `minmax(${props.topMinHeight}px, 1fr) minmax(0, 1fr)` }
  }
  return { gridTemplateRows: `${resolvedTopSize.value}px minmax(0, 1fr)` }
})
const splitHandleStyle = computed<CSSProperties>(() => ({
  top: `${resolvedTopSize.value}px`,
}))

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function measureTopSize(): void {
  measuredStackHeight.value = stackRef.value?.getBoundingClientRect().height ?? 0
  const height = topPanelRef.value?.getBoundingClientRect().height ?? 0
  if (height > 0) measuredTopSize.value = height
}

function handleWidthResizeStart(): void {
  widthStartExtent.value = props.extent
  widthCurrentExtent.value = props.extent
  isResizing.value = true
  emit('resize-start', 'width')
}

function handleWidthResize(change: OcResizeHandleChange): void {
  widthCurrentExtent.value = change.value
  emit('update:extent', change.value)
}

function handleWidthResizeEnd(): void {
  const settled = settleCdeOverlayExtent(
    widthCurrentExtent.value,
    widthStartExtent.value,
    geometryConfig.value,
  )
  emit('update:extent', settled)
  isResizing.value = false
  emit('resize-end', 'width')
}

function handleWidthResizeCancel(): void {
  emit('update:extent', widthStartExtent.value)
  isResizing.value = false
  emit('resize-end', 'width')
}

function handleSplitResizeStart(): void {
  measureTopSize()
  splitStartValue.value = splitValue.value
  isResizing.value = true
  emit('resize-start', 'split')
}

function handleSplitResize(change: OcResizeHandleChange): void {
  splitValue.value = change.value
  emit('update:top-size', change.value)
}

function handleSplitResizeEnd(): void {
  isResizing.value = false
  emit('resize-end', 'split')
}

function handleSplitResizeCancel(): void {
  splitValue.value = splitStartValue.value
  emit('update:top-size', splitStartValue.value)
  isResizing.value = false
  emit('resize-end', 'split')
}

watch(() => props.topSize, value => {
  if (value !== null) splitValue.value = value
})

watch(resolvedTopSize, value => {
  if (!isResizing.value) splitValue.value = value
}, { flush: 'sync' })

onMounted(() => {
  void nextTick(measureTopSize)
  if (typeof ResizeObserver === 'undefined' || !stackRef.value) return
  resizeObserver = new ResizeObserver(entries => {
    measureTopSize()
    if (props.topSize !== null) emit('update:top-size', clamp(props.topSize, props.topMinHeight, splitMaximum.value))
    const stage = dockRef.value?.parentElement
    const stageEntry = entries.find(entry => entry.target === stage)
    const stageWidth = stageEntry?.contentRect.width ?? 0
    if (
      stageWidth > 0
      && stageWidth < props.responsiveMinStageWidth
      && props.extent > props.collapsedExtent
    ) {
      emit('update:extent', props.collapsedExtent)
    }
  })
  resizeObserver.observe(stackRef.value)
  if (dockRef.value?.parentElement) resizeObserver.observe(dockRef.value.parentElement)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
.cde-overlay-dock {
  position: absolute;
  z-index: var(--oc-z-overlay-toolbar);
  min-width: 0;
  min-height: 0;
  pointer-events: none;
}

.cde-overlay-dock--left { left: 0; }
.cde-overlay-dock--right { right: 0; }

.cde-overlay-dock__stack {
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  gap: var(--oc-space-3);
  pointer-events: none;
}

.cde-overlay-dock__panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  pointer-events: auto;
}

.cde-overlay-dock__panel > :deep(*) {
  min-width: 0;
  min-height: 0;
}

.cde-overlay-dock__split-handle {
  position: absolute;
  right: 0;
  left: 0;
  z-index: 2;
  height: var(--oc-space-3);
  transform: translateY(calc(var(--oc-space-3) / -2));
  pointer-events: auto;
}

.cde-overlay-dock__width-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: auto;
}

.cde-overlay-dock--left .cde-overlay-dock__width-handle {
  right: calc(var(--oc-space-3) * -1);
}

.cde-overlay-dock--right .cde-overlay-dock__width-handle {
  left: calc(var(--oc-space-3) * -1);
}
</style>
