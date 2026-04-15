<template>
  <div class="floating-menu-list">
    <div
      v-for="item in items"
      :key="item.key"
      class="floating-menu-item"
      :class="{ 'is-disabled': item.disabled, 'has-children': item.children?.length }"
      role="menuitem"
      :aria-disabled="item.disabled ? 'true' : 'false'"
    >
      <OcMenuItemButton
        class="floating-menu-button"
        :label="item.label"
        :icon="item.icon"
        :has-children="Boolean(item.children?.length)"
        :disabled="Boolean(item.disabled)"
        @click="handleItemClick(item)"
      />

      <div v-if="item.children?.length" class="floating-submenu oc-floating-surface">
        <FloatingMenuList :items="item.children" @select="emit('select', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FloatingMenuItem } from '../../composables/useFloatingMenu'
import OcMenuItemButton from '../base/OcMenuItemButton.vue'

defineOptions({ name: 'FloatingMenuList' })

defineProps<{
  items: readonly FloatingMenuItem[]
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

function handleItemClick(item: FloatingMenuItem): void {
  if (item.disabled || item.children?.length) {
    return
  }

  emit('select', item.key)
}
</script>

<style scoped>
.floating-menu-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.floating-menu-item {
  position: relative;
}

.floating-menu-button:hover,
.floating-menu-item:hover > .floating-menu-button {
  background: var(--oc-bg-active);
}

.floating-menu-item.is-disabled > .floating-menu-button {
  color: var(--oc-text-disabled);
  cursor: default;
}

.floating-menu-item.is-disabled > .floating-menu-button:hover {
  background: transparent;
}

.floating-submenu {
  position: absolute;
  top: -3px;
  left: calc(100% - 3px);
  display: none;
}

.floating-menu-item:hover > .floating-submenu {
  display: block;
}
</style>
