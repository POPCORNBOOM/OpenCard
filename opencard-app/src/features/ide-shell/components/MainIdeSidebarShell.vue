<template>
  <OcSidebarFrame
    class="main-ide-sidebar-shell"
    :activity-width="'var(--main-ide-sidebar-activity-width)'"
    :panel-width="'var(--main-ide-sidebar-panel-width)'"
    :panel-visible="Boolean(activeView)"
  >
    <template #activity>
      <OcToolbar kind="sidebar" align="center" padding="14px 0" aria-label="Activity bar">
        <OcToolButton
          kind="sidebar"
          width="100%"
          height="56px"
          icon-only
          :active="activeView === 'files'"
          :title="t('sidebar.files')"
          :aria-label="t('sidebar.files')"
          @click="emit('update:activeView', 'files')"
        >
          <AppIcon name="app.files" tone="primary" />
        </OcToolButton>
        <OcToolButton
          kind="sidebar"
          width="100%"
          height="56px"
          icon-only
          :active="activeView === 'git'"
          :title="t('sidebar.git')"
          :aria-label="t('sidebar.git')"
          @click="emit('update:activeView', 'git')"
        >
          <AppIcon name="app.git" tone="danger" />
        </OcToolButton>
        <OcToolButton
          kind="sidebar"
          width="100%"
          height="56px"
          icon-only
          :active="activeView === 'publish'"
          :title="t('sidebar.publish')"
          :aria-label="t('sidebar.publish')"
          @click="emit('update:activeView', 'publish')"
        >
          <AppIcon name="app.publish" tone="warning" />
        </OcToolButton>
      </OcToolbar>
    </template>

    <template #panel>
      <OcPanelSection
        fill
        header-padding="0 18px"
        header-min-height="40px"
        body-padding="14px 16px 16px"
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

          <OcEmptyHint v-else-if="activeView === 'git'" align="start" padding="0" class="main-ide-sidebar-shell__empty">
            {{ t('panels.gitPlaceholder') }}
          </OcEmptyHint>

          <OcEmptyHint v-else-if="activeView === 'publish'" align="start" padding="0" class="main-ide-sidebar-shell__empty">
            {{ t('panels.publishPlaceholder') }}
          </OcEmptyHint>
        </template>
      </OcPanelSection>
    </template>
  </OcSidebarFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppIcon from '../../../components/ui/AppIcon.vue'
import { OcEmptyHint, OcPanelSection, OcSidebarFrame, OcToolButton, OcToolbar } from '../../../components/base'

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
  --main-ide-sidebar-activity-width: 68px;
  --main-ide-sidebar-panel-width: 288px;
  min-width: 0;
  min-height: 0;
}

.main-ide-sidebar-shell__files {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.main-ide-sidebar-shell__empty {
  line-height: 1.7;
}

@media (max-width: 1200px) {
  .main-ide-sidebar-shell {
    --main-ide-sidebar-panel-width: 272px;
  }
}

@media (max-width: 1024px) {
  .main-ide-sidebar-shell {
    --main-ide-sidebar-activity-width: 64px;
  }
}
</style>
