<!-- Standard 菜单项按钮：用于下拉菜单或上下文菜单中的单个操作项。 -->
<script setup lang="ts">
import type { IconResolvable } from '../../shared/ui/icon/iconRegistry'
import OcIcon from '../base/OcIcon.vue'

interface Props {
  label: string
  icon?: IconResolvable
  hasChildren?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  hasChildren: false,
  disabled: false
})

const emit = defineEmits<{
  'click': [event: MouseEvent]
}>()

defineOptions({ name: 'OcMenuItemButton' })
</script>

<template>
  <button
    class="oc-menu-item-button"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <div class="oc-menu-item-button__content">
      <OcIcon v-if="icon" :name="icon" class="oc-menu-item-button__icon" />
      <span class="oc-menu-item-button__label">{{ label }}</span>
    </div>
    <OcIcon v-if="hasChildren" name="nav.chevron-right" class="oc-menu-item-button__chevron" />
  </button>
</template>

<style scoped>
.oc-menu-item-button {
  width: 100%;
  height: var(--oc-size-md);
  padding: 0 var(--oc-space-3);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-2);
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--oc-text-base);
  color: var(--oc-fg-default);
  transition: background-color 0.2s;
}

.oc-menu-item-button:hover:not(:disabled) {
  background-color: var(--oc-bg-hover);
}

.oc-menu-item-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oc-menu-item-button__content {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  flex: 1;
  min-width: 0;
}

.oc-menu-item-button__icon {
  flex-shrink: 0;
}

.oc-menu-item-button__label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.oc-menu-item-button__chevron {
  flex-shrink: 0;
}
</style>

