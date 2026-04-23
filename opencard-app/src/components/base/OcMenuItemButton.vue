<template>
  <OcPressable
    class="oc-menu-item-button"
    variant="ghost"
    size="md"
    radius="md"
    :disabled="disabled"
    @click="emit('click', $event)"
  >
    <span class="oc-menu-item-button__main">
      <OcIcon v-if="icon" :name="icon" size="sm" />
      <span v-else class="oc-menu-item-button__icon-placeholder" />
      <OcText as="span" class="oc-menu-item-button__label">{{ label }}</OcText>
    </span>
    <OcIcon v-if="hasChildren" name="icon.chevron-right" class="oc-menu-item-button__chevron" size="sm" />
  </OcPressable>
</template>

<script setup lang="ts">
import { OcIcon, OcPressable, OcText } from '../../shared/ui/primitives'

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
  text-align: left;
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
