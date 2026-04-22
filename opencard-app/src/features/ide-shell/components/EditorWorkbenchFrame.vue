<template>
  <div class="editor-workbench-frame">
    <OcTabBar v-if="sessions.length > 0" class="editor-workbench-frame__tabs" :aria-label="t('sidebar.openedEditors')">
      <OcTab
        v-for="session in sessions"
        :key="session.id"
        :label="session.name"
        :title="session.name"
        :active="activeSessionId === session.id"
        :dirty="Boolean(session.isDirty)"
        :closable="true"
        :close-aria-label="`Close ${session.name}`"
        @select="emit('selectSession', session.id)"
        @close="emit('closeSession', session.id)"
      />
    </OcTabBar>

    <div class="editor-workbench-frame__content" :class="`editor-workbench-frame__content--${props.surfaceMode}`">
      <div v-if="!hasActiveSession" class="welcome-screen">
        <p class="welcome-screen__eyebrow">{{ t('app.welcome.eyebrow') }}</p>
        <h1>{{ t('app.welcome.title') }}</h1>
        <p class="welcome-subtitle">{{ t('app.welcome.subtitle') }}</p>
        <div class="welcome-actions">
          <OcButton variant="primary" @click="emit('openProject')">{{ t('sidebar.openProject') }}</OcButton>
          <OcButton variant="ghost" @click="emit('openUiKit')">UI Kit</OcButton>
        </div>
        <div class="welcome-points" aria-hidden="true">
          <span>{{ t('app.welcome.featureExplore') }}</span>
          <span>{{ t('app.welcome.featureDesign') }}</span>
          <span>{{ t('app.welcome.featurePreview') }}</span>
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
import { OcButton, OcTab, OcTabBar } from '../../../components/base'

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
  openUiKit: []
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
  min-height: 0;
  overflow: auto;
  display: flex;
  padding: 16px 18px 18px;
  background:
    linear-gradient(180deg, var(--oc-bg-subtle) 0%, var(--oc-bg-base) 140px, var(--oc-bg-base) 100%);
}

.editor-workbench-frame__content--immersive {
  padding: 0;
  background: var(--oc-bg-base);
}

.welcome-screen {
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: min(520px, 100%);
  margin: auto;
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
  font-size: clamp(44px, 7vw, 72px);
  line-height: 0.94;
  letter-spacing: -0.05em;
  color: var(--oc-text-primary);
}

.welcome-subtitle {
  margin: 0;
  color: var(--oc-text-dim);
  font-size: var(--oc-body-size);
  line-height: 1.7;
}

.welcome-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--oc-space-2);
}

.welcome-points {
  display: flex;
  flex-wrap: wrap;
  gap: var(--oc-space-2);
}

.welcome-points span {
  font-size: var(--oc-label-size);
  color: var(--oc-text-secondary);
  background: var(--oc-bg-panel);
  border: 1px solid var(--oc-border-subtle);
  padding: 5px 10px;
  border-radius: var(--oc-radius-pill);
}

.editor-workbench-frame__workbench {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  animation: editor-workbench-enter var(--oc-motion-duration-base) var(--oc-motion-ease-standard);
}

.editor-workbench-frame__workbench > :deep(*) {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

@keyframes editor-workbench-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .editor-workbench-frame__content {
    padding: 12px;
  }
}
</style>
