<template>
  <div class="oc-action-rail">
    <OcActionButton
      v-for="action in actions"
      :key="action.key"
      :action="action"
      :size="size"
      :icon-size="iconSize"
      :variant="variant"
      @select="emit('select', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import type { OcIconSize } from '../base/OcIcon.vue'
import OcActionButton, {
  type ActionButtonSize,
  type ActionButtonVariant,
  type OcActionButtonAction,
  type OcActionButtonSelectPayload,
} from './OcActionButton.vue'

withDefaults(defineProps<{
  actions: readonly OcActionButtonAction[]
  size?: ActionButtonSize
  iconSize?: OcIconSize
  variant?: ActionButtonVariant
}>(), {
  size: 'sm',
  iconSize: 'action',
  variant: 'ghost',
})

const emit = defineEmits<{
  select: [payload: OcActionButtonSelectPayload]
}>()
</script>

<style scoped>
.oc-action-rail {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--oc-overlay-toolbar-item-gap, var(--oc-space-1));
}
</style>
