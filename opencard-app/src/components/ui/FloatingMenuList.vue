<template>
  <div class="floating-menu-list" role="menu">
    <div
      v-for="item in items"
      :key="item.key"
      class="floating-menu-item"
      :class="{ 'is-disabled': item.disabled, 'has-children': item.children?.length }"
      @mouseenter="handleItemMouseEnter(item)"
      @mouseleave="handleItemMouseLeave($event, item)"
      @focusin="handleItemFocusIn(item)"
      @focusout="handleItemFocusOut($event, item)"
    >
      <OcMenuItemButton
        class="floating-menu-button"
        :label="item.label"
        :icon="item.icon"
        :has-children="Boolean(item.children?.length)"
        :disabled="Boolean(item.disabled)"
        role="menuitem"
        :aria-disabled="item.disabled ? 'true' : 'false'"
        :aria-haspopup="item.children?.length ? 'menu' : undefined"
        :aria-expanded="item.children?.length ? String(isItemExpanded(item)) : undefined"
        @click="handleItemClick(item)"
      />

      <div v-if="item.children?.length" class="floating-submenu floating-menu-surface" role="menu">
        <FloatingMenuList :items="item.children" @select="emit('select', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { FloatingMenuItem } from '../../composables/useFloatingMenu'
import OcMenuItemButton from '../standard/OcMenuItemButton.vue'

defineOptions({ name: 'FloatingMenuList' })

defineProps<{
  items: readonly FloatingMenuItem[]
}>()

const emit = defineEmits<{
  select: [key: string]
}>()

const hoveredItemKey = ref<string | null>(null)
const focusedItemKey = ref<string | null>(null)

function hasChildren(item: FloatingMenuItem): boolean {
  return Boolean(item.children?.length)
}

function isItemExpanded(item: FloatingMenuItem): boolean {
  return hasChildren(item) && (hoveredItemKey.value === item.key || focusedItemKey.value === item.key)
}

function handleItemMouseEnter(item: FloatingMenuItem): void {
  if (!hasChildren(item) || item.disabled) {
    return
  }

  hoveredItemKey.value = item.key
}

function handleItemMouseLeave(_event: MouseEvent, item: FloatingMenuItem): void {
  if (hoveredItemKey.value !== item.key) {
    return
  }

  hoveredItemKey.value = null
}

function handleItemFocusIn(item: FloatingMenuItem): void {
  if (!hasChildren(item) || item.disabled) {
    return
  }

  focusedItemKey.value = item.key
}

function handleItemFocusOut(event: FocusEvent, item: FloatingMenuItem): void {
  if (!hasChildren(item) || focusedItemKey.value !== item.key) {
    return
  }

  const currentTarget = event.currentTarget
  const nextTarget = event.relatedTarget
  if (currentTarget instanceof HTMLElement && nextTarget instanceof Node && currentTarget.contains(nextTarget)) {
    return
  }

  focusedItemKey.value = null
}

function handleItemClick(item: FloatingMenuItem): void {
  if (item.disabled) {
    return
  }

  if (hasChildren(item)) {
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

.floating-menu-surface {
  min-width: 148px;
  padding: 3px;
  border: 1px solid var(--oc-border-surface);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-panel);
  box-shadow: var(--oc-shadow-overlay);
}

.floating-menu-item:hover > .floating-submenu,
.floating-menu-item:focus-within > .floating-submenu {
  display: block;
}
</style>
