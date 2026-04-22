<template>
  <header class="main-ide-top-bar">
    <div class="main-ide-top-bar__brand" aria-label="OpenCard workspace">
      <div class="main-ide-top-bar__name">OpenCard</div>
      <div v-if="projectName" class="main-ide-top-bar__project">{{ projectName }}</div>
    </div>

    <OcToolbar class="main-ide-top-bar__menu" kind="menu" aria-label="Main menu">
      <OcToolButton kind="menu" :label="t('app.menu.file')" :disabled="true" />
      <OcToolButton kind="menu" :label="t('app.menu.edit')" :disabled="true" />
      <OcToolButton kind="menu" :label="t('app.menu.view')" :disabled="true" />
      <OcToolButton kind="menu" :label="t('app.menu.help')" :disabled="true" />
    </OcToolbar>

    <OcToolbar class="main-ide-top-bar__actions" kind="menu" aria-label="Workspace actions">
      <OcToolButton kind="menu" label="UI Kit" @click="emit('openUiKit')" />
      <OcToolButton
        kind="menu"
        :label="t('app.menu.export2x')"
        :disabled="!canExportActiveCard"
        @click="emit('exportActiveCard2x')"
      />
      <OcToolButton
        kind="menu"
        :label="t('app.menu.exportAll')"
        :disabled="!canExportActiveCard"
        @click="emit('exportAllCardViews')"
      />
    </OcToolbar>
  </header>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OcToolButton, OcToolbar } from '../../../components/base'

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
  height: 52px;
  background: var(--oc-bg-app-chrome);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 18px;
  border-bottom: 1px solid var(--oc-border-strong);
}

.main-ide-top-bar__brand {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: var(--oc-space-3);
  flex-shrink: 0;
}

.main-ide-top-bar__name {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--oc-text-primary);
}

.main-ide-top-bar__project {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-border-subtle);
  border-radius: var(--oc-radius-pill);
  padding: 4px 10px;
}

.main-ide-top-bar__menu {
  flex: 1;
  min-width: 0;
}

.main-ide-top-bar__actions {
  flex-shrink: 0;
}

@media (max-width: 1200px) {
  .main-ide-top-bar__project {
    display: none;
  }
}

@media (max-width: 1024px) {
  .main-ide-top-bar {
    padding: 0 12px;
    gap: 12px;
  }

  .main-ide-top-bar__name {
    font-size: 18px;
  }
}
</style>
