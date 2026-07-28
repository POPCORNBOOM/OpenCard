<template>
  <Teleport to="body">
    <div v-if="open && release" class="release-notes-dialog__backdrop">
      <section
        class="release-notes-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @keydown.esc.prevent="handleClose"
      >
        <header>
          <h2 :id="titleId">{{ t('app.updater.releaseNotesTitle', { version: release.version }) }}</h2>
        </header>

        <div
          v-if="release.body"
          class="release-notes-dialog__body"
          v-html="renderedBody"
        />
        <p v-else class="release-notes-dialog__empty">{{ t('app.updater.releaseNotesEmpty') }}</p>

        <footer>
          <OcButton :disabled="installing" @click="handleClose">
            {{ t('app.updater.releaseNotesClose') }}
          </OcButton>
          <OcButton
            v-if="available"
            variant="solid"
            icon="action.download"
            :disabled="installing"
            @click="emit('install')"
          >
            {{ installing ? t('app.updater.installing') : t('app.updater.installVersion', { version: release.version }) }}
          </OcButton>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import { renderMarkdown } from '../../card-rendering/markdown/renderMarkdown'
import type { ReleaseNotesSnapshot } from '../composables/updateStatePersistence'

const props = defineProps<{
  open: boolean
  release: ReleaseNotesSnapshot | null
  available: boolean
  installing: boolean
}>()

const emit = defineEmits<{
  close: []
  install: []
}>()

const { t } = useI18n()
const titleId = `release-notes-title-${Math.random().toString(36).slice(2)}`
const renderedBody = computed(() => renderMarkdown(props.release?.body ?? ''))

function handleClose(): void {
  if (!props.installing) emit('close')
}
</script>

<style scoped>
.release-notes-dialog__backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: var(--oc-space-6);
  background: color-mix(in srgb, var(--oc-bg-base) 68%, transparent);
}

.release-notes-dialog {
  width: min(640px, 100%);
  max-height: min(720px, calc(100vh - 48px));
  display: grid;
  grid-template-rows: auto minmax(120px, 1fr) auto;
  overflow: hidden;
  border: 1px solid var(--oc-border-default);
  border-radius: var(--oc-radius-lg);
  background: var(--oc-bg-surface);
  box-shadow: var(--oc-shadow-lg);
  color: var(--oc-fg-default);
}

.release-notes-dialog header,
.release-notes-dialog footer {
  padding: var(--oc-space-5);
}

.release-notes-dialog header {
  border-bottom: 1px solid var(--oc-border-muted);
}

.release-notes-dialog h2,
.release-notes-dialog__empty {
  margin: 0;
}

.release-notes-dialog h2 {
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
}

.release-notes-dialog__body,
.release-notes-dialog__empty {
  overflow: auto;
  padding: var(--oc-space-5);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-base);
  line-height: 1.65;
}

.release-notes-dialog__body :deep(:first-child) {
  margin-top: 0;
}

.release-notes-dialog__body :deep(:last-child) {
  margin-bottom: 0;
}

.release-notes-dialog__body :deep(ul),
.release-notes-dialog__body :deep(ol) {
  padding-inline-start: var(--oc-space-5);
}

.release-notes-dialog__body :deep(h1),
.release-notes-dialog__body :deep(h2),
.release-notes-dialog__body :deep(h3) {
  color: var(--oc-fg-default);
  font-size: var(--oc-text-base);
}

.release-notes-dialog footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--oc-space-2);
  border-top: 1px solid var(--oc-border-default);
  background: var(--oc-bg-raised);
}
</style>
