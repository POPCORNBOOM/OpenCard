<template>
  <OcSidebarFrame
    class="main-ide-sidebar-shell"
    activity-size="default"
    panel-size="default"
    :panel-visible="Boolean(activeView)"
  >
    <template #activity>
      <OcToolbar kind="sidebar" align="center" spacing="none" inset="comfortable" aria-label="Activity bar">
        <OcToolButton
          kind="sidebar"
          size="lg"
          block
          icon-only
          :active="activeView === 'files'"
          :title="t('sidebar.files')"
          :aria-label="t('sidebar.files')"
          @click="emit('update:activeView', 'files')"
        >
          <OcIcon name="app.files" tone="primary" />
        </OcToolButton>
        <OcToolButton
          kind="sidebar"
          size="lg"
          block
          icon-only
          :active="activeView === 'git'"
          :title="t('sidebar.git')"
          :aria-label="t('sidebar.git')"
          @click="emit('update:activeView', 'git')"
        >
          <OcIcon name="app.git" tone="danger" />
        </OcToolButton>
        <OcToolButton
          kind="sidebar"
          size="lg"
          block
          icon-only
          :active="activeView === 'publish'"
          :title="t('sidebar.publish')"
          :aria-label="t('sidebar.publish')"
          @click="emit('update:activeView', 'publish')"
        >
          <OcIcon name="app.publish" tone="warning" />
        </OcToolButton>
      </OcToolbar>
    </template>

    <template #panel>
      <OcPanelSection
        fill
        header-density="comfortable"
        header-inset="comfortable"
        body-inset="comfortable"
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
import { OcEmptyHint, OcPanelSection, OcSidebarFrame, OcToolButton, OcToolbar } from '../../../components/base'
import { OcIcon } from '../../../shared/ui/primitives'

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
</style>
