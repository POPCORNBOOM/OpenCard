<template>
  <div class="oc-sidebar-frame" :style="frameStyle">
    <aside class="oc-sidebar-frame__activity">
      <slot name="activity" />
    </aside>
    <section v-if="panelVisible" class="oc-sidebar-frame__panel">
      <slot name="panel" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

defineOptions({ name: 'OcSidebarFrame' })

const props = withDefaults(defineProps<{
  activityWidth?: string
  panelWidth?: string
  panelVisible?: boolean
}>(), {
  activityWidth: '68px',
  panelWidth: '288px',
  panelVisible: true,
})

const frameStyle = computed<CSSProperties>(() => ({
  '--oc-sidebar-frame-activity-width': props.activityWidth,
  '--oc-sidebar-frame-panel-width': props.panelWidth,
}))
</script>

<style scoped>
.oc-sidebar-frame {
  min-width: 0;
  min-height: 0;
  display: flex;
}

.oc-sidebar-frame__activity {
  width: var(--oc-sidebar-frame-activity-width);
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  background: var(--oc-bg-app-chrome);
  border-right: 1px solid var(--oc-border-strong);
}

.oc-sidebar-frame__panel {
  width: var(--oc-sidebar-frame-panel-width);
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  background: var(--oc-bg-panel);
  border-right: 1px solid var(--oc-border-strong);
}
</style>
