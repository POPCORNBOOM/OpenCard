<template>
  <OcDialog
    :open="Boolean(version)"
    :title="editMode ? t('versioning.publish.editTitle') : t('versioning.publish.title')"
    :description="editMode ? t('versioning.publish.editDescription') : t('versioning.publish.description')"
    as="form"
    size="md"
    :dismissible="!busy"
    close-on-backdrop
    @request-close="emit('close')"
    @submit="submit"
  >
  <div v-if="version" class="publish-version-dialog__body">
      <p v-if="error" class="publish-version-dialog__error" role="alert">{{ error }}</p>
      <label class="publish-version-dialog__field">
        <span>{{ t('versioning.fields.version') }}</span>
        <OcFieldInput
          v-if="allowRenumber && !editMode"
          :value="versionValue"
          full-width
          required
          :disabled="busy"
          @input="versionValue = fieldValue($event)"
        />
        <span v-else>v{{ version.version }}</span>
      </label>
      <label class="publish-version-dialog__field">
        <span>{{ t('versioning.fields.releaseDescription') }}</span>
        <OcFieldInput
          as="textarea"
          :value="description"
          full-width
          resize="vertical"
          rows="5"
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
      <OcButton type="submit" variant="solid" :disabled="busy || !canSubmit">
        {{ busy ? t('versioning.publish.publishing') : submitLabel }}
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
import type { VersionRecordDto } from '../model/versioning'

const props = defineProps<{
  version: DeepReadonly<VersionRecordDto> | null
  allowRenumber: boolean
  editMode: boolean
  busy: boolean
  error?: string | null
}>()
const emit = defineEmits<{
  close: []
  submit: [version: string, description: string]
}>()
const { t } = useI18n()
const versionValue = ref('')
const description = ref('')
const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const canSubmit = computed(() => {
  const descriptionLength = [...description.value.trim()].length
  return semanticVersionPattern.test(versionValue.value.trim())
    && descriptionLength >= 1
    && descriptionLength <= 500
})
const submitLabel = computed(() => (
  props.editMode ? t('versioning.publish.saveDescription') : t('versioning.actions.publish')
))

watch(
  () => [props.version, props.editMode] as const,
  ([version, editMode]) => {
    if (!version) return
    versionValue.value = version.version
    description.value = editMode ? version.release?.description ?? '' : version.description
  },
  { immediate: true },
)

function fieldValue(event: Event): string {
  return (event.target as HTMLInputElement | HTMLTextAreaElement).value
}

function submit(): void {
  if (canSubmit.value) emit('submit', versionValue.value.trim(), description.value.trim())
}
</script>

<style scoped>
.publish-version-dialog__body,
.publish-version-dialog__field {
  display: grid;
  gap: var(--oc-space-3);
}

.publish-version-dialog__body {
  gap: var(--oc-space-5);
}

.publish-version-dialog__error {
  margin: 0;
  color: var(--oc-fg-danger);
}
</style>
