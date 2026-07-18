<!-- IDE 中间侧栏面板：根据激活 key 切换并渲染 files/git/publish 三个固定面板槽位。 -->
<template>
  <OcCard variant="plain" fill>
    <OcPanel fill grow direction="vertical" tone="surface" border="none" padding="none" align="stretch" overflow="hidden">
      <OcPanel
        v-if="activeKey === 'files'"
        fill
        grow
        direction="vertical"
        tone="surface"
        border="none"
        padding="none"
        gap="2"
        align="stretch"
        overflow="hidden"
      >
        <slot name="files" />
      </OcPanel>

      <OcPanel
        v-else-if="activeKey === 'git'"
        fill
        grow
        direction="vertical"
        tone="surface"
        border="none"
        padding="none"
        align="stretch"
        overflow="hidden"
      >
        <slot name="git">
          <OcEmpty class="main-ide-panel-switch__empty">
            {{ t('panels.gitPlaceholder') }}
          </OcEmpty>
        </slot>
      </OcPanel>

      <OcPanel
        v-else-if="activeKey === 'publish'"
        fill
        grow
        direction="vertical"
        tone="surface"
        border="none"
        padding="none"
        align="stretch"
        overflow="hidden"
      >
        <slot name="publish">
          <OcEmpty class="main-ide-panel-switch__empty">
            {{ t('panels.publishPlaceholder') }}
          </OcEmpty>
        </slot>
      </OcPanel>
    </OcPanel>
  </OcCard>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OcEmpty, OcPanel } from '../../../components/base'
import { OcCard } from '../../../components/standard'

type IdeSidebarViewKey = 'files' | 'git' | 'publish'

interface MainIdePanelSwitchProps {
  activeKey: IdeSidebarViewKey | null
}

defineProps<MainIdePanelSwitchProps>()
defineOptions({ name: 'MainIdePanelSwitch' })

const { t } = useI18n()
</script>

<style scoped>
.main-ide-panel-switch__empty {
  margin: var(--oc-space-4);
}
</style>
