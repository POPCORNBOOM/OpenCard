<script setup lang="ts">
import packageMetadata from '../../../../package.json'
import { useI18n } from 'vue-i18n'
import staticLogo from '../../../assets/icon_v2.png'
import OcButton from '../../../components/base/OcButton.vue'

defineOptions({ name: 'AboutWorkspace' })

const emit = defineEmits<{
  back: []
}>()

const { t } = useI18n()
const version = packageMetadata.version
</script>

<template>
  <section class="about-workspace" :aria-label="t('app.about.title')">
    <div class="about-workspace__content">
      <div class="about-workspace__brand">
        <img :src="staticLogo" alt="OpenCard" />
        <div>
          <p class="about-workspace__eyebrow">{{ t('app.about.eyebrow') }}</p>
          <h1>OpenCard</h1>
          <p class="about-workspace__version">{{ t('app.about.version', { version }) }}</p>
        </div>
      </div>

      <div class="about-workspace__copy">
        <p>{{ t('app.about.description') }}</p>
        <p>{{ t('app.about.detail') }}</p>
      </div>

      <footer>
        <span>{{ t('app.about.copyright') }}</span>
        <OcButton icon="nav.arrow-left" variant="outline" @click="emit('back')">
          {{ t('app.about.back') }}
        </OcButton>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.about-workspace {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  color: var(--oc-fg-default);
}

.about-workspace__content {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--oc-content-width-md);
  margin-inline: auto;
  padding: 48px var(--oc-space-5);
  animation: about-workspace-enter var(--oc-duration-normal, 180ms) var(--oc-ease, ease) both;
}

.about-workspace__brand {
  display: flex;
  align-items: center;
  gap: var(--oc-space-5);
  padding-bottom: var(--oc-space-5);
  border-bottom: 1px solid var(--oc-border-muted);
}

.about-workspace__brand img {
  width: 72px;
  height: 72px;
  flex: 0 0 auto;
  object-fit: contain;
}

.about-workspace__eyebrow,
.about-workspace__version,
.about-workspace__copy p,
.about-workspace h1 {
  margin: 0;
}

.about-workspace__eyebrow {
  margin-bottom: var(--oc-space-1);
  color: var(--oc-fg-accent);
  font-size: var(--oc-text-sm);
}

.about-workspace h1 {
  font-size: 28px;
  font-weight: var(--font-weight-ui-title);
  line-height: 1.15;
}

.about-workspace__version {
  margin-top: var(--oc-space-2);
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-base);
}

.about-workspace__copy {
  display: grid;
  gap: var(--oc-space-3);
  max-width: 560px;
  padding: var(--oc-space-6) 0;
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-base);
  line-height: 1.7;
}

.about-workspace footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--oc-space-4);
  padding-top: var(--oc-space-4);
  border-top: 1px solid var(--oc-border-muted);
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-sm);
}

@keyframes about-workspace-enter {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
}

@media (max-width: 640px) {
  .about-workspace__content {
    padding: 32px var(--oc-space-4);
  }

  .about-workspace__brand {
    align-items: flex-start;
  }

  .about-workspace footer {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .about-workspace__content {
    animation: none;
  }
}
</style>
