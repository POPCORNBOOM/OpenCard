<!-- UI 浮动菜单宿主：承载全局菜单语义与打开态关闭策略，几何定位交给 OcFloatingLayer。 -->
<template>
  <OcFloatingLayer
    :open="state.isOpen && Boolean(menuAnchor)"
    :anchor="menuAnchor"
    :placement="state.placement"
    class="floating-menu-surface"
    @pointerdown.stop
  >
    <OcTree
      :data="menuTreeData"
      role="menu"
      selection-mode="none"
      activation-mode="single-click"
      @intent="handleIntent"
    />
  </OcFloatingLayer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import OcTree from '../standard/OcTree.vue'
import OcFloatingLayer from '../standard/OcFloatingLayer.vue'
import { useFloatingMenu } from '../../composables/useFloatingMenu'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../shared/ui/tree/tree.types'

defineOptions({ name: 'FloatingMenuHost' })

const { state, closeMenu, selectMenuItem } = useFloatingMenu()
const menuAnchor = computed(() => state.value.anchor)
const menuTreeData = computed<OcTreeData>(() => {
  const rootKeys: string[] = []
  const items = new Map<string, OcTreeItem>()
  for (const item of state.value.items) {
    rootKeys.push(item.key)
    items.set(item.key, {
      label: item.label,
      icon: item.icon,
      disabled: item.disabled,
    })
  }
  return { rootKeys, items, children: new Map() }
})

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'node.activate') selectMenuItem(intent.key)
}

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

<style scoped>
.floating-menu-surface {
  min-width: 148px;
  padding: 3px;
  overflow-y: auto;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
}
</style>
