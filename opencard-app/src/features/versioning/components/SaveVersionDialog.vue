<template>
  <OcDialog
    :open="Boolean(confirmation)"
    :title="confirmation?.publish ? t('versioning.save.publishTitle') : t('versioning.save.title')"
    :description="confirmation?.publish ? t('versioning.save.publishDescription') : t('versioning.save.description')"
    as="form"
    size="md"
    :dismissible="!busy"
    close-on-backdrop
    @request-close="emit('close')"
    @submit="submit"
  >
    <div v-if="confirmation" class="save-version-dialog__body">
      <p v-if="error" class="save-version-dialog__error" role="alert">{{ error }}</p>
      <dl class="save-version-dialog__summary">
        <div>
          <dt>{{ t('versioning.fields.version') }}</dt>
          <dd>v{{ confirmation.version }}</dd>
        </div>
        <div>
          <dt>{{ t('versioning.fields.changes') }}</dt>
          <dd>
            {{ t('versioning.changeSummary', {
              total: changeTotal,
              added: confirmation.changeSummary.added,
              modified: confirmation.changeSummary.modified,
              deleted: confirmation.changeSummary.deleted,
            }) }}
          </dd>
        </div>
      </dl>

      <label v-if="confirmation?.publish" class="save-version-dialog__field">
        <span>{{ t('versioning.fields.version') }}</span>
        <OcFieldInput
          :value="version"
          full-width
          required
          :disabled="busy"
          @input="version = fieldValue($event)"
        />
      </label>
      <label class="save-version-dialog__field">
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
      <label v-if="confirmation?.publish" class="save-version-dialog__field">
        <span>{{ t('versioning.fields.releaseDescription') }}</span>
        <OcFieldInput
          as="textarea"
          :value="releaseDescription"
          full-width
          resize="vertical"
          rows="4"
          maxlength="500"
          required
          :disabled="busy"
          @input="releaseDescription = fieldValue($event)"
        />
      </label>

      <details v-if="confirmation.changeSummary.files.length > 0" class="save-version-dialog__files">
        <summary>{{ t('versioning.save.changedFiles', { count: changeTotal }) }}</summary>
        <ul>
          <li v-for="file in confirmation.changeSummary.files" :key="file.path">
            <span :class="`is-${file.status}`">{{ changeSymbol(file.status) }}</span>
            <code>{{ file.path }}</code>
          </li>
        </ul>
      </details>
    </div>

    <template #footer>
      <OcButton type="button" variant="ghost" :disabled="busy" @click="emit('close')">
        {{ t('versioning.actions.cancel') }}
      </OcButton>
      <OcButton type="submit" variant="solid" :disabled="busy || !canSubmit">
        {{ busy
          ? t('versioning.save.saving')
          : confirmation?.publish ? t('versioning.save.publishSubmit') : t('versioning.save.submit') }}
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
import type {
  ChangeStatus,
  SaveVersionConfirmation,
} from '../model/versioning'

const props = defineProps<{
  confirmation: DeepReadonly<SaveVersionConfirmation> | null
  busy: boolean
  error?: string | null
}>()
const emit = defineEmits<{
  close: []
  submit: [description: string, version?: string, releaseDescription?: string]
}>()
const { t } = useI18n()
const description = ref('')
const version = ref('')
const releaseDescription = ref('')
const changeTotal = computed(() => props.confirmation?.changeSummary.files.length ?? 0)
const canSubmit = computed(() => {
  const length = [...description.value.trim()].length
  const validVersion = !props.confirmation?.publish || /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version.value.trim())
  const releaseLength = [...releaseDescription.value.trim()].length
  const validRelease = !props.confirmation?.publish || (releaseLength >= 1 && releaseLength <= 500)
  return length >= 1 && length <= 500 && changeTotal.value > 0 && validVersion && validRelease
})

watch(
  () => props.confirmation,
  confirmation => {
    if (confirmation) {
      description.value = t('versioning.save.defaultDescription')
      version.value = confirmation.version
      releaseDescription.value = description.value
    }
  },
  { immediate: true },
)

function fieldValue(event: Event): string {
  return (event.target as HTMLTextAreaElement).value
}

function changeSymbol(status: ChangeStatus): string {
  if (status === 'added') return '+'
  if (status === 'deleted') return '-'
  return '±'
}

function submit(): void {
  if (!canSubmit.value) return
  if (props.confirmation?.publish) {
    emit('submit', description.value.trim(), version.value.trim(), releaseDescription.value.trim())
  }
  else emit('submit', description.value.trim())
}
</script>

<style scoped>
.save-version-dialog__body {
  display: grid;
  gap: var(--oc-space-5);
}

.save-version-dialog__error {
  margin: 0;
  color: var(--oc-fg-danger);
}

.save-version-dialog__summary {
  display: grid;
  gap: var(--oc-space-3);
  margin: 0;
}

.save-version-dialog__summary > div {
  display: grid;
  grid-template-columns: minmax(7rem, 0.35fr) minmax(0, 1fr);
  gap: var(--oc-space-4);
}

.save-version-dialog__summary dt {
  color: var(--oc-fg-muted);
}

.save-version-dialog__summary dd {
  min-width: 0;
  margin: 0;
}

.save-version-dialog__field {
  display: grid;
  gap: var(--oc-space-2);
}

.save-version-dialog__files {
  border-top: var(--oc-border-width) solid var(--oc-border-muted);
  padding-top: var(--oc-space-3);
}

.save-version-dialog__files summary {
  cursor: pointer;
}

.save-version-dialog__files ul {
  display: grid;
  gap: var(--oc-space-1);
  max-height: 12rem;
  margin: var(--oc-space-3) 0 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.save-version-dialog__files li {
  display: grid;
  grid-template-columns: 1rem minmax(0, 1fr);
  gap: var(--oc-space-2);
  align-items: baseline;
}

.save-version-dialog__files code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.save-version-dialog__files .is-added {
  color: var(--oc-icon-success);
}

.save-version-dialog__files .is-modified {
  color: var(--oc-icon-warning);
}

.save-version-dialog__files .is-deleted {
  color: var(--oc-fg-danger);
}
</style>
