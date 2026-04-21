<template>
  <OcBox class="oc-property-row" inline>
    <label class="oc-property-row__label">
      <OcIcon v-if="labelIcon" class="oc-property-row__label-icon" :name="labelIcon" tone="muted" size="sm" />
      <OcText as="span" class="oc-property-row__label-text" tone="info" size="label">{{ label }}</OcText>
    </label>
    <OcBox class="oc-property-row__content" inline>
      <slot />
    </OcBox>
  </OcBox>
</template>

<script setup lang="ts">
import { OcBox, OcIcon, OcText } from '../../shared/ui/primitives'

defineOptions({ name: 'OcPropertyRow' })

defineProps<{
  label: string
  labelIcon?: string
}>()
</script>

<style scoped>
.oc-property-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}

.oc-property-row__label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 80px;
  flex-shrink: 0;
}

.oc-property-row__content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
</style>
