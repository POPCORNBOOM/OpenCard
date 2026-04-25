<template>
  <div class="editor-workbench-frame">
    <OcTabBar v-if="sessions.length > 0" :aria-label="t('sidebar.openedEditors')">
      <OcTab v-for="session in sessions" :key="session.id" :label="session.name" :title="session.name"
        :active="activeSessionId === session.id" :dirty="Boolean(session.isDirty)" :closable="true"
        :close-aria-label="`Close ${session.name}`" @select="emit('selectSession', session.id)"
        @close="emit('closeSession', session.id)" />
    </OcTabBar>

    <div class="editor-workbench-frame__content" :class="`editor-workbench-frame__content--${props.surfaceMode}`">
      <div v-if="!hasActiveSession" class="welcome-screen">
        <p class="welcome-screen__eyebrow">{{ t('app.welcome.eyebrow') }}</p>
        <h1>{{ t('app.welcome.title') }}</h1>
        <p class="welcome-subtitle">{{ t('app.welcome.subtitle') }}</p>
        <div class="welcome-actions">
          <OcButton variant="primary" @click="emit('openProject')">{{ t('sidebar.openProject') }}</OcButton>
        </div>
        <div class="welcome-points" aria-hidden="true">
          <OcChip>{{ t('app.welcome.featureExplore') }}</OcChip>
          <OcChip>{{ t('app.welcome.featureDesign') }}</OcChip>
          <OcChip>{{ t('app.welcome.featurePreview') }}</OcChip>
        </div>
      </div>

      <div v-else class="editor-workbench-frame__workbench">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { OcButton, OcChip } from '../../../components/base'
import { OcTab, OcTabBar } from '../../../components/standard'

defineOptions({ name: 'EditorWorkbenchFrame' })

const props = withDefaults(defineProps<{
  sessions: readonly { id: string; name: string; isDirty?: boolean }[]
  activeSessionId: string | null
  hasActiveSession: boolean
  surfaceMode?: 'padded' | 'immersive'
}>(), {
  surfaceMode: 'padded',
})

const emit = defineEmits<{
  selectSession: [id: string]
  closeSession: [id: string]
  openProject: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.editor-workbench-frame {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-workbench-frame__content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  padding: 16px;
  background: var(--oc-bg-base);
}

.editor-workbench-frame__content--immersive {
  padding: 0;
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  margin: auto;
  width: min(520px, 100%);
  gap: var(--oc-space-3);
  color: var(--oc-text-muted);
}

.welcome-screen__eyebrow {
  margin: 0;
  font-size: var(--oc-label-size);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--oc-text-info);
}

.welcome-screen h1 {
  margin: 0;
  font-size: clamp(36px, 6vw, 62px);
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--oc-text-primary);
}

.welcome-subtitle {
  margin: 0;
  color: var(--oc-text-dim);
}

.welcome-actions,
.welcome-points {
  display: flex;
  flex-wrap: wrap;
  gap: var(--oc-space-2);
}

.editor-workbench-frame__workbench {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
}

.editor-workbench-frame__workbench> :deep(*) {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
}
</style>
