<!-- IDE 顶栏：通过声明式动作组承载主菜单与工作区动作入口。 -->
<template>
  <OcBar kind="top">
    <template #title>
      <div class="main-ide-top-bar__brand" aria-label="OpenCard workspace">
        <div data-tauri-drag-region class="main-ide-top-bar__name">OpenCard</div>
        <OcChip v-if="projectName" class="main-ide-top-bar__project" truncate max-width="lg">
          {{ projectName }}
        </OcChip>
      </div>
    </template>

    <OcActionGroup preset="menu" grow :actions="mainMenuActions" aria-label="Main menu" />

    <template #append>
      <OcActionGroup preset="menu" :shrink="false" :actions="workspaceActions" aria-label="Workspace actions"
        @action="handleWorkspaceAction" />
    </template>
  </OcBar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { OcChip } from '../../../components/base'
import { OcBar } from '../../../components/standard'
import { OcActionGroup } from '../../../components/standard'
import type { OcActionGroupAction, OcActionGroupActionPayload } from '../../../components/standard/OcActionGroup.vue'
import type { OcThemeId } from '../../../shared/ui/foundation'

defineOptions({ name: 'MainIdeTopBar' })

type WorkspaceActionKey =
  | 'workspace.new-open-card'
  | 'workspace.toggle-theme'
  | 'workspace.export-active-card-2x'
  | 'workspace.export-all-card-views'

interface MainIdeTopBarProps {
  /** 当前项目名称。 */
  projectName?: string
  /** 当前激活会话是否允许导出。 */
  canExportActiveCard: boolean
  /** 当前应用主题。 */
  currentTheme: OcThemeId
}

interface MainIdeTopBarEmits {
  /** 请求创建一个未保存的 OpenCard 会话。 */
  newOpenCard: []
  /** 请求切换主题（dark/light）。 */
  toggleTheme: []
  /** 请求导出当前卡片 2x 视图。 */
  exportActiveCard2x: []
  /** 请求导出当前卡片所有视图。 */
  exportAllCardViews: []
}

const emit = defineEmits<MainIdeTopBarEmits>()
const props = defineProps<MainIdeTopBarProps>()

const { t } = useI18n()
const themeButtonLabel = computed(() => `Theme: ${props.currentTheme}`)

const mainMenuActions = computed<readonly OcActionGroupAction[]>(() => [
  { key: 'menu.file', label: t('app.menu.file'), disabled: true },
  { key: 'menu.edit', label: t('app.menu.edit'), disabled: true },
  { key: 'menu.view', label: t('app.menu.view'), disabled: true },
  { key: 'menu.help', label: t('app.menu.help'), disabled: true },
])

const workspaceActions = computed<readonly OcActionGroupAction[]>(() => [
  { key: 'workspace.new-open-card', label: t('app.menu.newOpenCard') },
  { key: 'workspace.toggle-theme', label: themeButtonLabel.value },
  {
    key: 'workspace.export-active-card-2x',
    label: t('app.menu.export2x'),
    disabled: !props.canExportActiveCard,
  },
  {
    key: 'workspace.export-all-card-views',
    label: t('app.menu.exportAll'),
    disabled: !props.canExportActiveCard,
  },
])

function handleWorkspaceAction(payload: OcActionGroupActionPayload): void {
  if (!isWorkspaceActionKey(payload.key)) {
    return
  }

  if (payload.key === 'workspace.new-open-card') {
    emit('newOpenCard')
    return
  }

  if (payload.key === 'workspace.toggle-theme') {
    emit('toggleTheme')
    return
  }

  if (payload.key === 'workspace.export-active-card-2x') {
    emit('exportActiveCard2x')
    return
  }

  emit('exportAllCardViews')
}

function isWorkspaceActionKey(key: string): key is WorkspaceActionKey {
  return key === 'workspace.new-open-card'
    || key === 'workspace.toggle-theme'
    || key === 'workspace.export-active-card-2x'
    || key === 'workspace.export-all-card-views'
}
</script>

<style scoped>
.main-ide-top-bar__brand {
  min-width: max-content;
  display: flex;
  align-items: baseline;
  gap: var(--oc-space-3);
  flex: 0 0 auto;
  align-self: stretch;
  user-select: none;
}

.main-ide-top-bar__name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--oc-fg-default);
  user-select: none;
}
</style>
