<template>
  <div class="oc-property-row">
    <label class="oc-property-row__label">{{ label }}</label>
    <div class="oc-property-row__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'OcPropertyRow' })

defineProps<{
  label: string
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
  font-size: var(--oc-label-size);
  color: var(--oc-text-info);
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
