<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcPanel from '../../../components/base/OcPanel.vue'

defineOptions({ name: 'WorkbenchWorkspace' })

defineProps<{
  hasActiveEditor: boolean
}>()

const { t } = useI18n()
</script>

<template>
  <OcPanel v-if="hasActiveEditor" fill tone="transparent" border="none" padding="none" overflow="hidden">
    <div class="workbench-workspace__editor-stage">
      <slot />
    </div>
  </OcPanel>
  <section v-else class="workspace-empty-state" :aria-label="t('app.editorEmpty.title')">
    <OcIcon class="workspace-empty-state__icon" name="file.generic" size="lg" />
    <h1>{{ t('app.editorEmpty.title') }}</h1>
    <p>{{ t('app.editorEmpty.subtitle') }}</p>
  </section>
</template>

<style scoped>
.workbench-workspace__editor-stage {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.workspace-empty-state {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-5);
  color: var(--oc-fg-default);
  text-align: center;
}

.workspace-empty-state__icon {
  margin-bottom: var(--oc-space-2);
  color: var(--oc-fg-subtle);
}

.workspace-empty-state h1,
.workspace-empty-state p {
  margin: 0;
}

.workspace-empty-state h1 {
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
}

.workspace-empty-state p {
  max-width: 360px;
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-base);
  line-height: 1.5;
}
</style>
