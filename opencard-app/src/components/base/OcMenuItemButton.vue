<template>
  <button
    class="oc-menu-item-button"
    type="button"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <span class="oc-menu-item-button__main">
      <i v-if="icon" class="codicon" :class="icon" />
      <span v-else class="oc-menu-item-button__icon-placeholder" />
      <span class="oc-menu-item-button__label">{{ label }}</span>
    </span>
    <i v-if="hasChildren" class="codicon codicon-chevron-right oc-menu-item-button__chevron" />
  </button>
</template>

<script setup lang="ts">
defineOptions({ name: 'OcMenuItemButton' })

withDefaults(defineProps<{
  label: string
  icon?: string
  hasChildren?: boolean
  disabled?: boolean
}>(), {
  icon: undefined,
  hasChildren: false,
  disabled: false,
})

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void
}>()
</script>

<style scoped>
.oc-menu-item-button {
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
  font-size: var(--oc-body-size);
  text-align: left;
  cursor: pointer;
}

.oc-menu-item-button:hover:not(:disabled) {
  background: var(--oc-bg-active);
}

.oc-menu-item-button:disabled {
  color: var(--oc-text-disabled);
  cursor: default;
}

.oc-menu-item-button__main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.oc-menu-item-button__icon-placeholder {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.oc-menu-item-button__label {
  white-space: nowrap;
}

.oc-menu-item-button__chevron {
  font-size: 10px;
}
</style>
