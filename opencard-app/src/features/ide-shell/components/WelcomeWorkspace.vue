<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OcButton } from '../../../components/base'

defineOptions({ name: 'WelcomeWorkspace' })

const emit = defineEmits<{
  'new-project': []
  'open-project': []
}>()

const { t } = useI18n()
</script>

<template>
  <section class="workspace-empty-state" :aria-label="t('app.welcome.title')">
    <img class="workspace-empty-state__icon" :src="'/icon_v2.png'" alt="" />
    <h1>{{ t('app.welcome.title') }}</h1>
    <p>{{ t('app.welcome.subtitle') }}</p>
    <div class="workspace-empty-state__actions">
      <OcButton icon="action.add" variant="solid" size="lg" @click="emit('new-project')">
        {{ t('app.menu.newProject') }}
      </OcButton>
      <OcButton icon="status.folder-open" variant="outline" size="lg" @click="emit('open-project')">
        {{ t('sidebar.openProject') }}
      </OcButton>
    </div>
  </section>
</template>

<style scoped>
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
  width: 72px;
  height: 72px;
  margin-bottom: var(--oc-space-2);
  object-fit: contain;
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

.workspace-empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--oc-space-2);
  margin-top: var(--oc-space-3);
}
</style>
