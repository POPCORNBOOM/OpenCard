<!-- UI 浮动菜单宿主：承载全局菜单语义与打开态关闭策略，几何定位交给 OcFloatingLayer。 -->
<template>
  <OcFloatingLayer
    :open="state.isOpen && Boolean(menuAnchor)"
    :anchor="menuAnchor"
    :placement="state.placement"
    class="floating-menu-surface"
    @pointerdown.stop
  >
    <OcActionMenu
      :actions="state.items"
      @select="selectMenuItem($event.key)"
    />
  </OcFloatingLayer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import OcActionMenu from '../standard/OcActionMenu.vue'
import OcFloatingLayer from '../standard/OcFloatingLayer.vue'
import { useFloatingMenu } from '../../composables/useFloatingMenu'

defineOptions({ name: 'FloatingMenuHost' })

const { state, closeMenu, selectMenuItem } = useFloatingMenu()
const menuAnchor = computed(() => state.value.anchor)
function handlePointerDown(): void {
  closeMenu()
}

function handleWindowKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !state.value.isOpen) {
    return
  }

  event.preventDefault()
  closeMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('keydown', handleWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('keydown', handleWindowKeydown)
})
</script>
