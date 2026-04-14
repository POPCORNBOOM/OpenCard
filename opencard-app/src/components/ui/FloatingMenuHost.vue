<template>
  <Teleport to="body">
    <div v-if="state.isOpen && state.anchorRect" class="floating-menu-layer">
      <div ref="panelRef" class="floating-menu-panel oc-floating-surface" :style="panelStyle" role="menu">
        <FloatingMenuList :items="state.items" @select="handleSelect" />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import FloatingMenuList from './FloatingMenuList.vue'
import { useFloatingMenu } from '../../composables/useFloatingMenu'

defineOptions({ name: 'FloatingMenuHost' })

const { state, closeMenu, selectMenuItem } = useFloatingMenu()
const panelRef = ref<HTMLElement | null>(null)
const panelPosition = ref({ top: 0, left: 0 })

const panelStyle = computed(() => ({
  top: `${panelPosition.value.top}px`,
  left: `${panelPosition.value.left}px`,
}))

function updatePanelPosition(): void {
  const anchorRect = state.value.anchorRect
  const panel = panelRef.value
  if (!anchorRect || !panel) {
    return
  }

  const gap = 6
  const panelRect = panel.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  const preferredLeft = state.value.placement === 'bottom-start'
    ? anchorRect.left
    : anchorRect.right - panelRect.width
  const preferredTop = anchorRect.bottom + gap

  const left = Math.min(
    Math.max(8, preferredLeft),
    Math.max(8, viewportWidth - panelRect.width - 8),
  )

  const top = preferredTop + panelRect.height <= viewportHeight - 8
    ? preferredTop
    : Math.max(8, anchorRect.top - panelRect.height - gap)

  panelPosition.value = { top, left }
}

function handleSelect(key: string): void {
  selectMenuItem(key)
}

function handlePointerDown(event: MouseEvent): void {
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (panelRef.value?.contains(target)) {
    return
  }

  closeMenu()
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !state.value.isOpen) {
    return
  }

  event.preventDefault()
  closeMenu()
}

function handleViewportChange(): void {
  if (!state.value.isOpen) {
    return
  }

  closeMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('scroll', handleViewportChange, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('resize', handleViewportChange)
  window.removeEventListener('scroll', handleViewportChange, true)
})

watch(
  () => [state.value.isOpen, state.value.anchorRect, state.value.items] as const,
  async ([isOpen]) => {
    if (!isOpen) {
      return
    }

    await nextTick()
    updatePanelPosition()
  },
  { deep: true },
)
</script>

<style scoped>
.floating-menu-layer {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
}

.floating-menu-panel {
  position: fixed;
  pointer-events: auto;
}
</style>
