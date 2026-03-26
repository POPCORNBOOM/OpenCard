<template>
  <div
    ref="viewportRef"
    class="card-viewport"
    :class="{ 'card-viewport-panning': isPanning }"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
    @wheel.prevent="handleWheel"
  >
    <div class="card-viewport-stage" :style="stageStyle">
      <CardRenderer
        :document="document"
        :selected-block-ids="selectedBlockIds"
        :use-wrapper="useWrapper"
      />
    </div>
    <div class="card-viewport-debug">
      x: {{ Math.round(panX) }}, y: {{ Math.round(panY) }}, scale: {{ scale.toFixed(2) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CardDocument } from '../../core/Card'
import CardRenderer from './CardRenderer.vue'

const props = withDefaults(defineProps<{
  document: CardDocument
  selectedBlockIds?: string[]
  useWrapper?: boolean
}>(), {
  selectedBlockIds: () => [],
  useWrapper: true,
})

const viewportRef = ref<HTMLElement | null>(null)
const viewportWidth = ref(0)
const viewportHeight = ref(0)
const panX = ref(0)
const panY = ref(0)
const scale = ref(1)
const isPanning = ref(false)
const lastPointerX = ref(0)
const lastPointerY = ref(0)

let resizeObserver: ResizeObserver | null = null

const baseOffsetX = computed(() => {
  return (viewportWidth.value - props.document.width * scale.value) / 2
})

const baseOffsetY = computed(() => {
  return (viewportHeight.value - props.document.height * scale.value) / 2
})

const translateX = computed(() => baseOffsetX.value + panX.value)
const translateY = computed(() => baseOffsetY.value + panY.value)

const stageStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
}))

function handleMouseDown(event: MouseEvent) {
  if (event.button !== 1) return

  event.preventDefault()
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
  const previousScale = scale.value
  const nextScale = clamp(previousScale * (event.deltaY < 0 ? 1.1 : 1 / 1.1), 0.2, 4)

  const worldX = (mouseX - translateX.value) / previousScale
  const worldY = (mouseY - translateY.value) / previousScale

  scale.value = nextScale

  const nextBaseOffsetX = (viewportWidth.value - props.document.width * nextScale) / 2
  const nextBaseOffsetY = (viewportHeight.value - props.document.height * nextScale) / 2

  panX.value = mouseX - nextBaseOffsetX - worldX * nextScale
  panY.value = mouseY - nextBaseOffsetY - worldY * nextScale
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
.card-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background-color: #2d2d2d;
  background-image: radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px);
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

.card-viewport-debug {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(24, 24, 24, 0.82);
  color: #c8c8c8;
  font-size: 11px;
  line-height: 1.4;
  pointer-events: none;
}
</style>
