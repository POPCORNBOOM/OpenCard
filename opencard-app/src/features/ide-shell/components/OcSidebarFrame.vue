<!-- Base 侧栏框架：activity 图标栏 + panel 内容栏的双栏结构。 -->
<template>
  <div class="oc-sidebar-frame">
    <aside
      class="oc-sidebar-frame__activity"
      :style="{ width: activityWidthValue }"
    >
      <slot name="activity" />
    </aside>
    <section
      v-if="panelVisible"
      class="oc-sidebar-frame__panel"
      :style="{ width: panelWidthValue }"
    >
      <slot name="panel" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  activityWidth?: 'sm' | 'md' | 'lg'
  panelWidth?: 'sm' | 'md' | 'lg'
  panelVisible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  activityWidth: 'md',
  panelWidth: 'md',
  panelVisible: true,
})

defineOptions({ name: 'OcSidebarFrame' })

const activityWidthMap = {
  sm: '48px',
  md: '56px',
  lg: '64px',
}

const panelWidthMap = {
  sm: '260px',
  md: '320px',
  lg: '380px',
}

const activityWidthValue = computed(() => activityWidthMap[props.activityWidth])
const panelWidthValue = computed(() => panelWidthMap[props.panelWidth])
</script>

<style scoped>
.oc-sidebar-frame {
  display: flex;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.oc-sidebar-frame__activity {
  flex-shrink: 0;
  border-right: 1px solid var(--oc-border-strong);
  background: var(--oc-bg-raised);
}

.oc-sidebar-frame__panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--oc-border-strong);
  background: var(--oc-bg-surface);
}
</style>
