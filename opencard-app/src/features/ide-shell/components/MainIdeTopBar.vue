<template>
  <OcBar kind="top" border="bottom" class="main-ide-top-bar">
    <template #start>
      <div class="main-ide-top-bar__brand" aria-label="OpenCard workspace">
        <div class="main-ide-top-bar__name">OpenCard</div>
        <OcChip v-if="projectName" class="main-ide-top-bar__project" truncate max-width="lg">
          {{ projectName }}
        </OcChip>
      </div>
    </template>

    <OcToolbar kind="menu" grow aria-label="Main menu">
      <OcToolButton kind="menu" :label="t('app.menu.file')" :disabled="true" />
      <OcToolButton kind="menu" :label="t('app.menu.edit')" :disabled="true" />
      <OcToolButton kind="menu" :label="t('app.menu.view')" :disabled="true" />
      <OcToolButton kind="menu" :label="t('app.menu.help')" :disabled="true" />
    </OcToolbar>

    <template #end>
      <OcToolbar kind="menu" :shrink="false" aria-label="Workspace actions">
        <OcToolButton kind="menu" label="UI Kit" @click="emit('openUiKit')" />
        <OcToolButton kind="menu" :label="t('app.menu.export2x')" :disabled="!canExportActiveCard"
          @click="emit('exportActiveCard2x')" />
        <OcToolButton kind="menu" :label="t('app.menu.exportAll')" :disabled="!canExportActiveCard"
          @click="emit('exportAllCardViews')" />
      </OcToolbar>
    </template>
  </OcBar>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OcBar, OcChip, OcToolButton, OcToolbar } from '../../../components/base'

defineOptions({ name: 'MainIdeTopBar' })

defineProps<{
  projectName?: string
  canExportActiveCard: boolean
}>()

const emit = defineEmits<{
  openUiKit: []
  exportActiveCard2x: []
  exportAllCardViews: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.main-ide-top-bar {
  --oc-bar-gap: 18px;
  --oc-bar-padding: 0 18px;
}

.main-ide-top-bar__brand {
  min-width: max-content;
  display: flex;
  align-items: baseline;
  gap: var(--oc-space-3);
  flex: 0 0 auto;
}

.main-ide-top-bar__name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--oc-text-primary);
}
</style>
