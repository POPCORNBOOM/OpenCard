<template>
  <OcDialog :open="open" :title="t('app.exportDialog.title')"
    :description="t('app.exportDialog.description')" as="form" size="lg"
    height-mode="fixed" height="lg" close-on-backdrop :dismissible="!busy"
    @request-close="emit('close')" @submit="submit">
    <ProjectExportTaskEditor :model-value="modelValue" :documents="documents"
      :busy="busy" :preparation-issues="preparationIssues" show-validation
      @update:model-value="emit('update:modelValue', $event)" @update:valid="valid = $event" />

    <template #footer>
      <OcButton type="button" variant="ghost" :disabled="busy" @click="emit('close')">
        {{ t('app.exportDialog.cancel') }}
      </OcButton>
      <OcButton type="submit" variant="solid" :disabled="busy || !valid">
        {{ busy ? t('projectConfig.export.preparing') : t('projectConfig.export.submit') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import ProjectExportTaskEditor, {
  type ExportDocumentCandidate,
} from '../../../components/editors/ProjectExportTaskEditor.vue'
import type { ProjectExportTask } from '../../workspace/model/projectMetadata'
import type { ExportTaskValidationIssue } from '../exportTask'

defineProps<{
  open: boolean
  modelValue: ProjectExportTask
  documents: readonly ExportDocumentCandidate[]
  busy: boolean
  preparationIssues: readonly ExportTaskValidationIssue[]
}>()
const emit = defineEmits<{
  close: []
  submit: []
  'update:modelValue': [task: ProjectExportTask]
}>()
const { t } = useI18n()
const valid = ref(false)

function submit(): void {
  if (valid.value) emit('submit')
}
</script>
