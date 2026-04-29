<template>
  <OcSidebarFrame class="main-ide-sidebar-shell" activity-size="default" panel-size="default"
    :panel-visible="Boolean(activeView)">
    <template #activity>
      <OcToolbar kind="sidebar" align="center" spacing="none" inset="comfortable" aria-label="Activity bar">
        <OcToolButton kind="sidebar" size="lg" block icon-only icon="nav.files"
          :icon-tone="activeView === 'files' ? 'primary' : 'muted'" :active="activeView === 'files'"
          :title="t('sidebar.files')" :aria-label="t('sidebar.files')" @click="emit('update:activeView', 'files')" />
        <OcToolButton kind="sidebar" size="lg" block icon-only icon="status.source-control"
          :icon-tone="activeView === 'git' ? 'primary' : 'muted'" :active="activeView === 'git'"
          :title="t('sidebar.git')" :aria-label="t('sidebar.git')" @click="emit('update:activeView', 'git')" />
        <OcToolButton kind="sidebar" size="lg" block icon-only icon="action.publish"
          :icon-tone="activeView === 'publish' ? 'primary' : 'muted'" :active="activeView === 'publish'"
          :title="t('sidebar.publish')" :aria-label="t('sidebar.publish')"
          @click="emit('update:activeView', 'publish')" />
      </OcToolbar>
    </template>

    <template #panel>
      <OcCard variant="plain" :level="0">
        <template #content>
          <OcPanel orientation="vertical" tone="transparent" border="none" padding="none" overflow-x="clip"
            overflow-y="auto">
            <div v-if="activeView === 'files'" class="main-ide-sidebar-shell__files">
              <slot name="files" />
            </div>

            <OcEmpty v-else-if="activeView === 'git'" align="start" inset="none" class="main-ide-sidebar-shell__empty">
              {{ t('panels.gitPlaceholder') }}
            </OcEmpty>

            <OcEmpty v-else-if="activeView === 'publish'" align="start" inset="none"
              class="main-ide-sidebar-shell__empty">
              {{ t('panels.publishPlaceholder') }}
            </OcEmpty>
          </OcPanel>
        </template>
      </OcCard>
    </template>
  </OcSidebarFrame>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OcEmpty, OcPanel, OcSidebarFrame, OcToolbar } from '../../../components/base'
import { OcToolButton } from '../../../components/standard'
import OcCard from '../../../components/base/OcCard.vue'

defineOptions({ name: 'MainIdeSidebarShell' })

interface MainIdeSidebarShellProps {
  /** 当前激活的侧栏视图。 */
  activeView: 'files' | 'git' | 'publish' | null
}

interface MainIdeSidebarShellEmits {
  /** 请求切换当前激活的侧栏视图。 */
  'update:activeView': [value: 'files' | 'git' | 'publish']
}

defineProps<MainIdeSidebarShellProps>()
const emit = defineEmits<MainIdeSidebarShellEmits>()

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
