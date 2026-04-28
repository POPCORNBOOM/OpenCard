<!-- IDE 顶栏：承载品牌信息与导出动作入口。 -->
<template>
  <OcBar class="main-ide-top-bar" tone="elevated" border="none" padding="none">
    <template #title>
      <div class="main-ide-top-bar__brand" aria-label="OpenCard workspace">
        <div class="main-ide-top-bar__name">OpenCard</div>
        <OcChip v-if="projectName" class="main-ide-top-bar__project" truncate max-width="lg">
          {{ projectName }}
        </OcChip>
      </div>
    </template>

    <OcToolbar kind="menu" grow aria-label="Main menu">
      <OcToolButton block kind="menu" :label="t('app.menu.file')" :disabled="true" />
      <OcToolButton block kind="menu" :label="t('app.menu.edit')" :disabled="true" />
      <OcToolButton block kind="menu" :label="t('app.menu.view')" :disabled="true" />
      <OcToolButton block kind="menu" :label="t('app.menu.help')" :disabled="true" />
    </OcToolbar>

    <template #append>
      <OcToolbar kind="menu" :shrink="false" aria-label="Workspace actions">
        <OcToolButton block kind="menu" :label="themeButtonLabel" @click="emit('toggleTheme')" />
        <OcToolButton block kind="menu" label="Playground" @click="emit('openPlayground')" />
        <OcToolButton block kind="menu" :label="t('app.menu.export2x')" :disabled="!canExportActiveCard"
          @click="emit('exportActiveCard2x')" />
        <OcToolButton block kind="menu" :label="t('app.menu.exportAll')" :disabled="!canExportActiveCard"
          @click="emit('exportAllCardViews')" />
      </OcToolbar>
    </template>
  </OcBar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { OcBar, OcChip, OcToolbar } from '../../../components/base'
import { OcToolButton } from '../../../components/standard'
import type { OcThemeId } from '../../../shared/ui/foundation'

defineOptions({ name: 'MainIdeTopBar' })

interface MainIdeTopBarProps {
  /** 当前项目名称。 */
  projectName?: string
  /** 当前激活会话是否允许导出。 */
  canExportActiveCard: boolean
  /** 当前应用主题。 */
  currentTheme: OcThemeId
}

interface MainIdeTopBarEmits {
  /** 请求切换主题（dark/light）。 */
  toggleTheme: []
  /** 请求打开组件 Playground 页面。 */
  openPlayground: []
  /** 请求导出当前卡片 2x 视图。 */
  exportActiveCard2x: []
  /** 请求导出当前卡片所有视图。 */
  exportAllCardViews: []
}

const emit = defineEmits<MainIdeTopBarEmits>()

const { t } = useI18n()
const props = defineProps<MainIdeTopBarProps>()
const themeButtonLabel = computed(() => `Theme: ${props.currentTheme}`)
</script>

<style scoped>
.main-ide-top-bar {
  --oc-bar-min-height: 52px;
  --oc-bar-gap: 18px;
  --oc-bar-padding: 0 18px;
  border-bottom: 1px solid var(--oc-border-strong);
}

.main-ide-top-bar__brand {
  min-width: max-content;
  display: flex;
  align-items: baseline;
  gap: var(--oc-space-3);
  flex: 0 0 auto;
  align-self: stretch;
}

.main-ide-top-bar__name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--oc-text-primary);
}
</style>
