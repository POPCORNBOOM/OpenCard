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
      <button class="floating-menu-button" type="button" :disabled="item.disabled" @click="handleItemClick(item)">
        <span class="floating-menu-main">
          <i v-if="item.icon" class="codicon" :class="item.icon" />
          <span v-else class="floating-menu-icon-placeholder" />
          <span class="floating-menu-label">{{ item.label }}</span>
        </span>
        <i v-if="item.children?.length" class="codicon codicon-chevron-right floating-menu-chevron" />
      </button>

      <div v-if="item.children?.length" class="floating-submenu oc-floating-surface">
        <FloatingMenuList :items="item.children" @select="emit('select', $event)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FloatingMenuItem } from '../../composables/useFloatingMenu'

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

.floating-menu-button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 5px 7px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--oc-text-primary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
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

.floating-menu-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.floating-menu-icon-placeholder {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.floating-menu-label {
  white-space: nowrap;
}

.floating-menu-chevron {
  font-size: 10px;
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
