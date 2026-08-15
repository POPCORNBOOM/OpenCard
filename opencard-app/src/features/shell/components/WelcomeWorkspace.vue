<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import phaseLogo from '../../../assets/opencard-logo-phase-map.png'
import wordmarkBrightness from '../../../assets/opencard-wordmark-brightness-map.png'
import wordmarkPhase from '../../../assets/opencard-wordmark-phase-map.png'
import OcButton from '../../../components/base/OcButton.vue'
import OcPhaseImage from '../../../components/standard/OcPhaseImage.vue'

defineOptions({ name: 'WelcomeWorkspace' })

const emit = defineEmits<{
  'new-project': []
  'open-project': []
}>()

defineProps<{
  activationError?: string
}>()

const { t } = useI18n()
</script>

<template>
  <section class="workspace-empty-state" :aria-label="t('app.welcome.title')">
    <OcPhaseImage
      class="workspace-empty-state__icon"
      :src="phaseLogo"
      fit="contain"
      alt="OpenCard"
    />
    <h1>
      <span>{{ t('app.welcome.prefix') }}</span>
      <OcPhaseImage
        class="workspace-empty-state__wordmark"
        :src="wordmarkPhase"
        :brightness-src="wordmarkBrightness"
        fit="contain"
        alt="OpenCard"
        :duration-ms="12_000"
        direction="reverse"
      />
    </h1>
    <p>{{ t('app.welcome.subtitle') }}</p>
    <p v-if="activationError" class="workspace-empty-state__error" role="alert">{{ activationError }}</p>
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
  --oc-phase-image-width: 72px;
  --oc-phase-image-aspect-ratio: 1;

  height: 72px;
  margin-bottom: var(--oc-space-2);
}

.workspace-empty-state h1,
.workspace-empty-state p {
  margin: 0;
}

.workspace-empty-state h1 {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-1);
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
}

.workspace-empty-state__wordmark {
  --oc-phase-image-width: 99px;
  --oc-phase-image-aspect-ratio: 3;

  height: 33px;
  flex: 0 0 auto;
}

.workspace-empty-state p {
  max-width: 360px;
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-base);
  line-height: 1.5;
}

.workspace-empty-state .workspace-empty-state__error {
  color: var(--oc-fg-danger);
}

.workspace-empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--oc-space-2);
  margin-top: var(--oc-space-3);
}
</style>
