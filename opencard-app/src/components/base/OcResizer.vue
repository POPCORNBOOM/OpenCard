<template>
  <div
    class="oc-resizer"
    :class="resizerClass"
    role="separator"
    :aria-orientation="orientation"
    :aria-label="ariaLabel"
    @mousedown="handleMouseDown"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ResizerOrientation = 'horizontal' | 'vertical'

defineOptions({ name: 'OcResizer' })

const props = withDefaults(defineProps<{
  orientation?: ResizerOrientation
  active?: boolean
  ariaLabel?: string
}>(), {
  orientation: 'vertical',
  active: false,
  ariaLabel: undefined,
})

const emit = defineEmits<{
  mousedown: [event: MouseEvent]
}>()

const resizerClass = computed(() => [
  `oc-resizer--${props.orientation}`,
  {
    'is-active': props.active,
  },
])

function handleMouseDown(event: MouseEvent): void {
  event.preventDefault()
  emit('mousedown', event)
}
</script>

<style scoped>
.oc-resizer {
  position: relative;
  flex-shrink: 0;
  background: transparent;
  touch-action: none;
}

.oc-resizer::before {
  content: '';
  position: absolute;
  border-radius: var(--oc-radius-pill);
  background: var(--oc-border-strong);
  transition:
    background-color var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
    box-shadow var(--oc-motion-duration-fast) var(--oc-motion-ease-standard);
}

.oc-resizer:hover::before {
  background: var(--oc-bg-hover-strong);
}

.oc-resizer.is-active::before {
  background: var(--oc-bg-accent);
  box-shadow: 0 0 0 1px var(--oc-bg-accent-soft);
}

.oc-resizer--vertical {
  width: 6px;
  cursor: col-resize;
}

.oc-resizer--vertical::before {
  inset: 0 2px;
}

.oc-resizer--horizontal {
  height: 6px;
  cursor: row-resize;
}

.oc-resizer--horizontal::before {
  inset: 2px 0;
}
</style>
