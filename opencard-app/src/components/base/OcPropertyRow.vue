<!-- Base 属性行：独立实现 label + field 双栏布局，不依赖 shared primitives。 -->
<template>
  <div class="oc-property-row">
    <label class="oc-property-row__label">
      <OcIcon v-if="labelIcon" class="oc-property-row__label-icon" :name="labelIcon" tone="muted" size="sm" />
      <span class="oc-property-row__label-text">{{ label }}</span>
    </label>
    <div class="oc-property-row__content">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from './OcIcon.vue'

interface OcPropertyRowProps {
  /** 左侧标签文案。 */
  label: string
  /** 左侧标签图标。 */
  labelIcon?: IconToken
}

defineOptions({ name: 'OcPropertyRow' })

defineProps<OcPropertyRowProps>()
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

.oc-property-row__label-text {
  color: var(--oc-text-info);
  font-size: var(--oc-label-size);
}

.oc-property-row__content {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
}
</style>
