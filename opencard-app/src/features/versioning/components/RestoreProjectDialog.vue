<template>
  <OcDialog
    :open="Boolean(target) && stage !== 'saving'"
    :title="stage === 'changes' ? t('versioning.restore.changesTitle') : t('versioning.restore.title')"
    :description="stage === 'changes' ? t('versioning.restore.changesDescription') : t('versioning.restore.description')"
    as="form"
    size="md"
    :dismissible="!busy"
    close-on-backdrop
    @request-close="emit('close')"
    @submit="submit"
  >
    <div v-if="target" class="restore-project-dialog__body">
      <p v-if="error" class="restore-project-dialog__error" role="alert">{{ error }}</p>
      <p>{{ t('versioning.restore.target', { version: `v${target.version}` }) }}</p>
      <dl class="restore-project-dialog__summary">
        <div>
          <dt>{{ t('versioning.fields.changes') }}</dt>
          <dd>{{ t('versioning.changeCounts', changes) }}</dd>
        </div>
      </dl>

      <template v-if="stage === 'changes'">
        <p>{{ t('versioning.restore.changesNotice') }}</p>
      </template>
      <label v-else class="restore-project-dialog__field">
        <span>{{ t('versioning.fields.description') }}</span>
        <OcFieldInput
          as="textarea"
          :value="description"
          full-width
          resize="vertical"
          rows="4"
          maxlength="500"
          required
          autofocus
          :disabled="busy"
          @input="description = fieldValue($event)"
        />
      </label>
    </div>

    <template #footer>
      <OcButton type="button" variant="ghost" :disabled="busy" @click="emit('close')">
        {{ t('versioning.actions.cancel') }}
      </OcButton>
      <template v-if="stage === 'changes'">
        <OcButton type="button" variant="outline" :disabled="busy" @click="emit('save-current')">
          {{ t('versioning.restore.saveCurrent') }}
        </OcButton>
        <OcButton type="button" variant="solid" :disabled="busy" @click="emit('discard-current')">
          {{ t('versioning.restore.discardCurrent') }}
        </OcButton>
      </template>
      <OcButton v-else type="submit" variant="solid" :disabled="busy || !canSubmit">
        {{ busy ? t('versioning.restore.restoring') : t('versioning.actions.restore') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, type DeepReadonly } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import type { ChangeSummaryDto, VersionRecordDto } from '../model/versioning'

const props = defineProps<{
  target: DeepReadonly<VersionRecordDto> | null
  stage: 'changes' | 'confirm' | 'saving'
  changes: Pick<ChangeSummaryDto, 'added' | 'modified' | 'deleted'>
  busy: boolean
  error?: string | null
}>()
const emit = defineEmits<{
  close: []
  'save-current': []
  'discard-current': []
  submit: [description: string]
}>()
const { t } = useI18n()
const description = ref('')
const canSubmit = computed(() => {
  const length = [...description.value.trim()].length
  return length >= 1 && length <= 500
})

watch(
  () => props.target,
  target => {
    if (target) description.value = t('versioning.restore.defaultDescription', { version: `v${target.version}` })
  },
  { immediate: true },
)

function fieldValue(event: Event): string {
  return (event.target as HTMLTextAreaElement).value
}

function submit(): void {
  if (canSubmit.value) emit('submit', description.value.trim())
}
</script>

<style scoped>
.restore-project-dialog__body,
.restore-project-dialog__field {
  display: grid;
  gap: var(--oc-space-3);
}

.restore-project-dialog__body {
  gap: var(--oc-space-5);
}

.restore-project-dialog__error {
  margin: 0;
  color: var(--oc-fg-danger);
}

.restore-project-dialog__summary {
  display: grid;
  gap: var(--oc-space-3);
  margin: 0;
}

.restore-project-dialog__summary > div {
  display: grid;
  grid-template-columns: minmax(7rem, 0.35fr) minmax(0, 1fr);
  gap: var(--oc-space-4);
}

.restore-project-dialog__summary dt {
  color: var(--oc-fg-muted);
}

.restore-project-dialog__summary dd {
  min-width: 0;
  margin: 0;
}
</style>
