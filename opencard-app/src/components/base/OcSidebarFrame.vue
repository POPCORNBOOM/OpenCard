<!-- Base 侧栏框架：独立实现 activity/panel 双栏结构与表面样式，不依赖 shared primitives。 -->
<template>
  <div class="oc-sidebar-frame" :class="frameClass">
    <OcPanel
      as="aside"
      class="oc-sidebar-frame__activity"
      tone="elevated"
      radius="none"
      border="none"
      padding="none"
    >
      <slot name="activity" />
    </OcPanel>
    <OcPanel
      v-if="panelVisible"
      as="section"
      class="oc-sidebar-frame__panel"
      tone="panel"
      radius="none"
      border="none"
      padding="none"
    >
      <slot name="panel" />
    </OcPanel>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OcPanel from './OcPanel.vue'

type SidebarActivitySize = 'compact' | 'default' | 'spacious'
type SidebarPanelSize = 'compact' | 'default' | 'spacious'

interface OcSidebarFrameProps {
  /** activity 区宽度语义。 */
  activitySize?: SidebarActivitySize
  /** panel 区宽度语义。 */
  panelSize?: SidebarPanelSize
  /** 是否显示 panel 区。 */
  panelVisible?: boolean
}

defineOptions({ name: 'OcSidebarFrame' })

const props = withDefaults(defineProps<OcSidebarFrameProps>(), {
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
  border-width: 0;
  border-right: 1px solid var(--oc-border-strong);
}

.oc-sidebar-frame__panel {
  width: 288px;
  min-width: 0;
  min-height: 0;
  flex: 0 0 auto;
  border-width: 0;
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
