<template>
  <div
    class="oc-resizer"
    :class="resizerClass"
    :style="resizerStyle"
    role="separator"
    :aria-orientation="orientation"
    :aria-label="ariaLabel"
    @mousedown="handleMouseDown"
  />
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

type ResizerOrientation = 'horizontal' | 'vertical'
type ResizerVariant = 'line' | 'edge'
type ResizerDock = 'left' | 'right' | 'top' | 'bottom'

defineOptions({ name: 'OcResizer' })

const props = withDefaults(defineProps<{
  orientation?: ResizerOrientation
  active?: boolean
  ariaLabel?: string
  variant?: ResizerVariant
  dock?: ResizerDock
  dockOffset?: string
}>(), {
  orientation: 'vertical',
  active: false,
  ariaLabel: undefined,
  variant: 'line',
  dock: undefined,
  dockOffset: '0',
})

const emit = defineEmits<{
  mousedown: [event: MouseEvent]
}>()

const resizerClass = computed(() => [
  `oc-resizer--${props.orientation}`,
  `oc-resizer--${props.variant}`,
  {
    'is-active': props.active,
  },
])

const resizerStyle = computed<CSSProperties | undefined>(() => {
  if (!props.dock) {
    return undefined
  }

  if (props.orientation === 'vertical') {
    const edge = props.dock === 'right' ? 'right' : 'left'
    return {
      position: 'absolute',
      top: '0',
      bottom: '0',
      [edge]: props.dockOffset,
    }
  }

  const edge = props.dock === 'bottom' ? 'bottom' : 'top'
  return {
    position: 'absolute',
    left: '0',
    right: '0',
    [edge]: props.dockOffset,
  }
})

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
  opacity: 1;
  transition:
    opacity var(--oc-motion-duration-fast) var(--oc-motion-ease-standard),
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

.oc-resizer--edge::before {
  opacity: 0;
}

.oc-resizer--vertical.oc-resizer--edge {
  width: 14px;
}

.oc-resizer--vertical.oc-resizer--edge::before {
  inset: 0 6px;
}

.oc-resizer--horizontal.oc-resizer--edge {
  height: 12px;
}

.oc-resizer--horizontal.oc-resizer--edge::before {
  inset: 5px 0;
}

.oc-resizer--edge:hover::before {
  opacity: 0.5;
}

.oc-resizer--edge.is-active::before {
  opacity: 1;
}
</style>
