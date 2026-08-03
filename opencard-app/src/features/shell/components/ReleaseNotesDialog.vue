<template>
  <OcDialog class="release-notes-dialog" :open="open && Boolean(release)"
    :title="t('app.updater.releaseNotesTitle', { version: release?.version ?? '' })"
    size="lg" height-mode="fixed" height="lg"
    :dismissible="!installing" @request-close="handleClose">
    <template v-if="release">
        <div
          v-if="release.body"
          class="release-notes-dialog__body"
          v-html="renderedBody"
        />
        <p v-else class="release-notes-dialog__empty">{{ t('app.updater.releaseNotesEmpty') }}</p>

    </template>
    <template v-if="release" #footer>
      <OcButton :disabled="installing" @click="handleClose">
        {{ t('app.updater.releaseNotesClose') }}
      </OcButton>
      <OcButton v-if="available" variant="solid" icon="action.download"
        :disabled="installing" @click="emit('install')">
        {{ installing ? t('app.updater.installing') : t('app.updater.installVersion', { version: release.version }) }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
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
const renderedBody = computed(() => renderMarkdown(props.release?.body ?? ''))

function handleClose(): void {
  if (!props.installing) emit('close')
}
</script>

<style scoped>
.release-notes-dialog__empty {
  margin: 0;
}

.release-notes-dialog__body,
.release-notes-dialog__empty {
  overflow: auto;
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

</style>
