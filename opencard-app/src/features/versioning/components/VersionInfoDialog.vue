<template>
  <OcDialog
    :open="Boolean(version)"
    :title="version ? `v${version.version}` : ''"
    :description="t('versioning.info.description')"
    size="md"
    :dismissible="!busy"
    close-on-backdrop
    @request-close="emit('close')"
  >
    <dl v-if="version" class="version-info-dialog__details">
      <div>
        <dt>{{ t('versioning.fields.status') }}</dt>
        <dd>{{ statusLabel }}</dd>
      </div>
      <div>
        <dt>{{ t('versioning.fields.savedAt') }}</dt>
        <dd>{{ new Date(version.savedAtUnixMs).toLocaleString(locale) }}</dd>
      </div>
      <div>
        <dt>{{ t('versioning.fields.description') }}</dt>
        <dd class="version-info-dialog__multiline">{{ version.description }}</dd>
      </div>
      <div>
        <dt>{{ t('versioning.fields.changes') }}</dt>
        <dd>{{ t('versioning.changeCounts', version.changes) }}</dd>
      </div>
      <template v-if="version.release">
        <div>
          <dt>{{ t('versioning.fields.publishedAt') }}</dt>
          <dd>{{ new Date(version.release.publishedAtUnixMs).toLocaleString(locale) }}</dd>
        </div>
        <div>
          <dt>{{ t('versioning.fields.releaseDescription') }}</dt>
          <dd class="version-info-dialog__multiline">{{ version.release.description }}</dd>
        </div>
      </template>
    </dl>

    <template #footer>
      <OcButton type="button" variant="ghost" :disabled="busy" @click="emit('close')">
        {{ t('versioning.actions.close') }}
      </OcButton>
      <OcButton
        v-if="version?.release"
        type="button"
        variant="outline"
        :disabled="busy"
        @click="emit('edit-release')"
      >
        {{ t('versioning.actions.editRelease') }}
      </OcButton>
      <OcButton
        v-if="version && version.commitId !== currentCommitId"
        type="button"
        variant="outline"
        :disabled="busy || !canRestore"
        @click="emit('restore')"
      >
        {{ t('versioning.actions.restore') }}
      </OcButton>
      <OcButton
        v-if="version && !version.release"
        type="button"
        variant="solid"
        :disabled="busy"
        @click="emit('publish')"
      >
        {{ t('versioning.actions.publish') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, type DeepReadonly } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import type { VersionRecordDto } from '../model/versioning'

const props = defineProps<{
  version: DeepReadonly<VersionRecordDto> | null
  currentCommitId: string | null
  busy: boolean
  locale: string
  canRestore?: boolean
}>()
const emit = defineEmits<{
  close: []
  publish: []
  'edit-release': []
  restore: []
}>()
const { t } = useI18n()
const statusLabel = computed(() => {
  const labels = []
  if (props.version?.commitId === props.currentCommitId) labels.push(t('versioning.list.current'))
  labels.push(props.version?.release ? t('versioning.list.published') : t('versioning.list.saved'))
  return labels.join(' · ')
})
</script>

<style scoped>
.version-info-dialog__details {
  display: grid;
  gap: var(--oc-space-3);
  margin: 0;
}

.version-info-dialog__details > div {
  display: grid;
  grid-template-columns: minmax(8rem, 0.35fr) minmax(0, 1fr);
  gap: var(--oc-space-4);
}

.version-info-dialog__details dt {
  color: var(--oc-fg-muted);
}

.version-info-dialog__details dd {
  min-width: 0;
  margin: 0;
}

.version-info-dialog__multiline {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
