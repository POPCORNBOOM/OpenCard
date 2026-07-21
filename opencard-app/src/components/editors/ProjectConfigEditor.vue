<template>
  <section class="project-config-editor" :aria-label="t('projectConfig.title')" @keydown.ctrl.s.prevent="save">
    <header class="project-config-editor__header">
      <OcIcon name="file.opencard-project" size="lg" />
      <div>
        <h1>{{ t('projectConfig.title') }}</h1>
        <OcText tone="muted" size="sm">{{ filePath }}</OcText>
      </div>
    </header>

    <div v-if="metadata" class="project-config-editor__form">
      <label class="project-config-editor__field">
        <span>{{ t('projectConfig.fields.name') }}</span>
        <OcFieldInput
          full-width
          :value="metadata.project.name"
          @input="updateField('name', $event)"
        />
      </label>

      <label class="project-config-editor__field">
        <span>{{ t('projectConfig.fields.description') }}</span>
        <OcFieldInput
          class="project-config-editor__description"
          as="textarea"
          full-width
          resize="none"
          :value="metadata.project.description"
          @input="updateField('description', $event)"
        />
      </label>

      <label class="project-config-editor__field">
        <span>{{ t('projectConfig.fields.entry') }}</span>
        <OcFieldInput
          full-width
          mono
          :value="metadata.project.entry"
          @input="updateField('entry', $event)"
        />
      </label>
    </div>

    <div v-else class="project-config-editor__invalid" role="alert">
      <OcIcon name="status.error" tone="danger" size="lg" />
      <OcText>{{ t('projectConfig.invalid') }}</OcText>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  parseProjectMetadataText,
  serializeProjectMetadata,
  type ProjectInformation,
  type ProjectMetadata,
} from '../../features/workspace/model/projectMetadata'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const metadata = ref<ProjectMetadata | null>(null)

watch(
  () => props.modelValue,
  (content) => {
    metadata.value = parseProjectMetadataText(content ?? '')
  },
  { immediate: true },
)

function updateField(key: keyof ProjectInformation, event: Event): void {
  if (!metadata.value) return
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  const nextMetadata: ProjectMetadata = {
    ...metadata.value,
    project: {
      ...metadata.value.project,
      [key]: target.value,
    },
  }
  metadata.value = nextMetadata
  emit('update:modelValue', serializeProjectMetadata(nextMetadata))
}

function save(): void {
  if (metadata.value) emit('save')
}

defineExpose({ save })
</script>

<style scoped>
.project-config-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  container-type: inline-size;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.project-config-editor__header,
.project-config-editor__form,
.project-config-editor__invalid {
  width: min(100%, 760px);
  margin-inline: auto;
  padding-inline: var(--oc-space-5);
}

.project-config-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
  padding-block: var(--oc-space-5) var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-muted);
}

.project-config-editor__header > div {
  min-width: 0;
}

.project-config-editor__header h1 {
  margin: 0 0 var(--oc-space-1);
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
}

.project-config-editor__form {
  display: grid;
  gap: var(--oc-space-4);
  padding-block: var(--oc-space-5);
}

.project-config-editor__field {
  display: grid;
  grid-template-columns: minmax(120px, 180px) minmax(0, 1fr);
  align-items: start;
  gap: var(--oc-space-4);
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-sm);
}

.project-config-editor__field > span {
  min-height: var(--oc-size-md);
  display: flex;
  align-items: center;
}

.project-config-editor__description {
  min-height: 96px;
}

.project-config-editor__invalid {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
  padding-block: var(--oc-space-5);
}

@container (max-width: 560px) {
  .project-config-editor__field {
    grid-template-columns: 1fr;
    gap: var(--oc-space-1);
  }
}
</style>
