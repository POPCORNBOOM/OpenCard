<template>
  <span
    ref="viewportRef"
    class="oc-overflow-text"
    :class="{
      'is-overflowing': isOverflowing,
      'is-scrolling': isOverflowing && (active || hovered),
    }"
    :style="{ textAlign: align }"
    :data-tooltip="isOverflowing ? text : undefined"
    @pointerenter="hovered = true"
    @pointerleave="hovered = false"
  >
    <span ref="contentRef" class="oc-overflow-text__content" :style="contentStyle">
      {{ text }}
    </span>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  text: string
  active?: boolean
  align?: 'left' | 'right'
  contentStyle?: Readonly<Record<string, string>>
}>(), {
  active: false,
  align: 'left',
  contentStyle: undefined,
})

const viewportRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const hovered = ref(false)
const isOverflowing = ref(false)
let resizeObserver: ResizeObserver | null = null

function measureOverflow(): void {
  const viewport = viewportRef.value
  const content = contentRef.value
  if (!viewport || !content) return

  const distance = Math.max(0, content.scrollWidth - viewport.clientWidth)
  isOverflowing.value = distance > 0
  viewport.style.setProperty('--oc-overflow-text-distance', `${distance}px`)
}

onMounted(() => {
  if (typeof ResizeObserver === 'function') {
    resizeObserver = new ResizeObserver(measureOverflow)
    if (viewportRef.value) resizeObserver.observe(viewportRef.value)
    if (contentRef.value) resizeObserver.observe(contentRef.value)
  } else {
    window.addEventListener('resize', measureOverflow)
  }
  measureOverflow()
})

watch(() => props.text, async () => {
  await nextTick()
  measureOverflow()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  window.removeEventListener('resize', measureOverflow)
})
</script>

<style scoped>
.oc-overflow-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}

.oc-overflow-text__content {
  display: inline-block;
  min-width: 100%;
  transform: translateX(0);
  white-space: nowrap;
}

.oc-overflow-text.is-scrolling .oc-overflow-text__content {
  animation: oc-overflow-text-pan var(--oc-overflow-text-duration) ease-in-out infinite alternate;
}

@keyframes oc-overflow-text-pan {
  0%, 15% { transform: translateX(0); }
  85%, 100% { transform: translateX(calc(-1 * var(--oc-overflow-text-distance))); }
}

@media (prefers-reduced-motion: reduce) {
  .oc-overflow-text.is-scrolling .oc-overflow-text__content {
    animation: none;
  }
}
</style>
