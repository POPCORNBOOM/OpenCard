<template>
  <div class="main-ide-sidebar-shell">
    <div class="main-ide-sidebar-shell__activity">
      <OcToolbar class="main-ide-sidebar-shell__activity-icons" kind="sidebar" aria-label="Activity bar">
        <OcToolButton
          class="main-ide-sidebar-shell__activity-icon"
          kind="sidebar"
          icon-only
          :active="activeView === 'files'"
          :title="t('sidebar.files')"
          :aria-label="t('sidebar.files')"
          @click="emit('update:activeView', 'files')"
        >
          <AppIcon name="app.files" tone="primary" />
        </OcToolButton>
        <OcToolButton
          class="main-ide-sidebar-shell__activity-icon"
          kind="sidebar"
          icon-only
          :active="activeView === 'git'"
          :title="t('sidebar.git')"
          :aria-label="t('sidebar.git')"
          @click="emit('update:activeView', 'git')"
        >
          <AppIcon name="app.git" tone="danger" />
        </OcToolButton>
        <OcToolButton
          class="main-ide-sidebar-shell__activity-icon"
          kind="sidebar"
          icon-only
          :active="activeView === 'publish'"
          :title="t('sidebar.publish')"
          :aria-label="t('sidebar.publish')"
          @click="emit('update:activeView', 'publish')"
        >
          <AppIcon name="app.publish" tone="warning" />
        </OcToolButton>
      </OcToolbar>
    </div>

    <OcPanelSection
      v-if="activeView"
      class="main-ide-sidebar-shell__panel"
      header-class="main-ide-sidebar-shell__header"
      body-class="main-ide-sidebar-shell__body"
      :scroll-body="true"
    >
      <template #title>
        <span v-if="activeView === 'files'">{{ t('sidebar.files') }}</span>
        <span v-else-if="activeView === 'git'">{{ t('sidebar.git') }}</span>
        <span v-else-if="activeView === 'publish'">{{ t('sidebar.publish') }}</span>
      </template>

      <template #default>
        <div v-if="activeView === 'files'" class="main-ide-sidebar-shell__files">
          <slot name="files" />
        </div>

        <div v-else-if="activeView === 'git'" class="main-ide-sidebar-shell__empty">
          <h3>{{ t('sidebar.git') }}</h3>
          <p class="main-ide-sidebar-shell__empty-copy">{{ t('panels.gitPlaceholder') }}</p>
        </div>

        <div v-else-if="activeView === 'publish'" class="main-ide-sidebar-shell__empty">
          <h3>{{ t('sidebar.publish') }}</h3>
          <p class="main-ide-sidebar-shell__empty-copy">{{ t('panels.publishPlaceholder') }}</p>
        </div>
      </template>
    </OcPanelSection>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '../../../components/ui/AppIcon.vue'
import { OcPanelSection, OcToolButton, OcToolbar } from '../../../components/base'

defineOptions({ name: 'MainIdeSidebarShell' })

defineProps<{
  activeView: 'files' | 'git' | 'publish' | null
}>()

const emit = defineEmits<{
  'update:activeView': [value: 'files' | 'git' | 'publish']
}>()

const { t } = useI18n()
</script>

<style scoped>
.main-ide-sidebar-shell {
  display: flex;
  min-width: 0;
  min-height: 0;
}

.main-ide-sidebar-shell__activity {
  width: 68px;
  background: var(--oc-bg-app-chrome);
  border-right: 1px solid var(--oc-border-strong);
}

.main-ide-sidebar-shell__activity-icons {
  align-items: center;
  padding: 14px 0;
}

.main-ide-sidebar-shell__activity-icon {
  width: 100%;
  height: 56px;
}

.main-ide-sidebar-shell__panel {
  width: 288px;
  background: var(--oc-bg-panel);
  border-right: 1px solid var(--oc-border-strong);
}

.main-ide-sidebar-shell__header {
  padding: 0 18px;
  min-height: 40px;
}

.main-ide-sidebar-shell__body {
  padding: 14px 16px 16px;
}

.main-ide-sidebar-shell__files {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.main-ide-sidebar-shell__empty {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: var(--oc-space-2);
}

.main-ide-sidebar-shell__empty h3 {
  margin: 0;
  font-size: var(--oc-title-size);
  color: var(--oc-text-primary);
}

.main-ide-sidebar-shell__empty-copy {
  margin: 0;
  color: var(--oc-text-dim);
  font-size: var(--oc-body-size);
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .main-ide-sidebar-shell__panel {
    width: 272px;
  }
}

@media (max-width: 1024px) {
  .main-ide-sidebar-shell__activity {
    width: 64px;
  }
}
</style>
