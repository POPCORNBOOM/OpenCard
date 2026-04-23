<template>
  <div class="oc-sidebar-frame" :class="frameClass">
    <OcSurface
      as="aside"
      class="oc-sidebar-frame__activity"
      variant="elevated"
      radius="none"
    >
      <slot name="activity" />
    </OcSurface>
    <OcSurface
      v-if="panelVisible"
      as="section"
      class="oc-sidebar-frame__panel"
      variant="panel"
      radius="none"
    >
      <slot name="panel" />
    </OcSurface>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OcSurface } from '../../shared/ui/primitives'

type SidebarActivitySize = 'compact' | 'default' | 'spacious'
type SidebarPanelSize = 'compact' | 'default' | 'spacious'

defineOptions({ name: 'OcSidebarFrame' })

const props = withDefaults(defineProps<{
  activitySize?: SidebarActivitySize
  panelSize?: SidebarPanelSize
  panelVisible?: boolean
}>(), {
  activitySize: 'default',
  panelSize: 'default',
  panelVisible: true,
})

const frameClass = computed(() => [
  `oc-sidebar-frame--activity-${props.activitySize}`,
  `oc-sidebar-frame--panel-${props.panelSize}`,
])
</script>

<style scoped>
.oc-sidebar-frame {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.oc-sidebar-frame__activity {
  width: 68px;
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  border-right: 1px solid var(--oc-border-strong);
}

.oc-sidebar-frame__panel {
  width: 288px;
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--oc-border-strong);
}

.oc-sidebar-frame--activity-compact .oc-sidebar-frame__activity {
  width: 60px;
}

.oc-sidebar-frame--activity-default .oc-sidebar-frame__activity {
  width: 68px;
}

.oc-sidebar-frame--activity-spacious .oc-sidebar-frame__activity {
  width: 72px;
}

.oc-sidebar-frame--panel-compact .oc-sidebar-frame__panel {
  width: 220px;
}

.oc-sidebar-frame--panel-default .oc-sidebar-frame__panel {
  width: 288px;
}

.oc-sidebar-frame--panel-spacious .oc-sidebar-frame__panel {
  width: 320px;
}
</style>
