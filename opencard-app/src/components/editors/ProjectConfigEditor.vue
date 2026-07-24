<template>
  <section class="project-profile-editor" :aria-label="t('projectConfig.title')" @keydown.ctrl.s.prevent="save">
    <div class="project-profile-editor__content">
      <header class="project-profile-editor__header">
        <OcIcon name="file.opencard-project" size="lg" />
        <div class="project-profile-editor__heading">
          <h1>{{ t('projectConfig.title') }}</h1>
          <OcText tone="muted" size="sm">{{ filePath }}</OcText>
        </div>
      </header>

      <template v-if="profile">
        <div class="project-profile-editor__form">
          <PropertyEditor
            :inputs="propertyInputs"
            :categories="propertyCategories"
            sort-mode="category"
            @update-property="updateProperty"
          />
        </div>

        <section class="project-profile-editor__dictionary">
          <div>
            <h2>{{ t('projectConfig.dictionary.title') }}</h2>
            <OcText tone="muted" size="sm">{{ t('projectConfig.dictionary.description') }}</OcText>
          </div>
          <OcButton
            :icon="dictionaryExists ? 'nav.arrow-right' : 'action.add'"
            variant="soft"
            @click="openOrCreateDictionary"
          >
            {{ dictionaryExists
              ? t('projectConfig.dictionary.open')
              : t('projectConfig.dictionary.create') }}
          </OcButton>
        </section>
      </template>

      <section v-else class="project-profile-editor__repair" role="alert">
        <div class="project-profile-editor__diagnostic">
          <OcIcon name="status.error" tone="danger" />
          <div>
            <strong>{{ t('projectConfig.invalid') }}</strong>
            <OcText tone="muted" size="sm">{{ t('projectConfig.repairHint') }}</OcText>
          </div>
        </div>
        <div class="project-profile-editor__source">
          <MonacoEditor
            :model-value="modelValue ?? ''"
            language="json"
            :theme-id="themeId"
            @update:model-value="updateRawSource"
            @save="save"
          />
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import {
  parseProjectMetadataText,
  serializeProjectMetadata,
  type ProjectProfile,
} from '../../features/workspace/model/projectMetadata'
import { PROJECT_DICTIONARY_FILE_NAME } from '../../features/workspace/model/projectDictionary'
import { resolveFileType } from '../../features/workspace/model/fileTypes'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../../shared/ui/property-editor/propertyEditor.types'
import MonacoEditor from './MonacoEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const profile = ref<ProjectProfile | null>(null)
const dictionaryExists = ref(false)

const themeId = computed(() => props.themeId ?? 'dark')
const propertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
  ['identity', { title: t('propertyEditor.categories.identity'), icon: 'data.symbol-class' }],
]))
const propertyInputs = computed<readonly PropertyEditorInput[]>(() => profile.value ? [{
  key: 'project-profile',
  record: {
    name: profile.value.name ?? '',
    description: profile.value.description ?? '',
    version: profile.value.version ?? '',
  },
  fields: {
    name: {
      fieldType: 'string',
      title: t('projectConfig.fields.name'),
      category: 'identity',
      defaultValue: '',
    },
    description: {
      fieldType: 'string',
      title: t('projectConfig.fields.description'),
      category: 'identity',
      multiline: true,
      defaultValue: '',
    },
    version: {
      fieldType: 'string',
      title: t('projectConfig.fields.version'),
      category: 'identity',
      defaultValue: '',
    },
  },
}] : [])

watch(() => props.modelValue, content => {
  profile.value = parseProjectMetadataText(content ?? '')
}, { immediate: true })

watch(() => projectStore.indexedEntries.value, () => {
  dictionaryExists.value = projectStore.indexedEntries.value.some(entry => (
    !entry.isDirectory
    && resolveFileType(
      projectStore.resolveProjectPath(entry.name),
      projectStore.projectPath.value,
    ).id === 'opencard-dictionary'
  ))
}, { immediate: true })

function updateProperty(payload: PropertyEditorMutation) {
  if (!profile.value || !['name', 'description', 'version'].includes(payload.fieldKey)) return
  const next: ProjectProfile = { ...profile.value, [payload.fieldKey]: String(payload.value) }
  if (payload.value === '') delete next[payload.fieldKey as keyof ProjectProfile]
  profile.value = next
  emit('update:modelValue', serializeProjectMetadata(next))
}

function updateRawSource(content: string) {
  emit('update:modelValue', content)
}

async function openOrCreateDictionary() {
  const path = projectStore.resolveProjectPath(PROJECT_DICTIONARY_FILE_NAME)
  try {
    if (!dictionaryExists.value) {
      await projectStore.createFile(PROJECT_DICTIONARY_FILE_NAME, '{}')
      dictionaryExists.value = true
    }
    emit('open-file', path)
  } catch (error) {
    console.error('[project-profile] Failed to open dictionary:', { path, error })
  }
}

function save() {
  if (profile.value) emit('save')
}

defineExpose({ save })
</script>

<style scoped>
.project-profile-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  background: var(--oc-bg-base);
  color: var(--oc-fg-default);
}

.project-profile-editor__content {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--oc-content-width-md);
  min-height: 100%;
  margin-inline: auto;
  padding: var(--oc-space-6) var(--oc-space-5);
}

.project-profile-editor__header,
.project-profile-editor__dictionary,
.project-profile-editor__diagnostic {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
}

.project-profile-editor__header {
  padding-bottom: var(--oc-space-4);
  border-bottom: 1px solid var(--oc-border-muted);
}

.project-profile-editor__heading {
  min-width: 0;
}

.project-profile-editor h1,
.project-profile-editor h2 {
  margin: 0;
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}

.project-profile-editor h1 {
  margin-bottom: var(--oc-space-1);
  font-size: var(--oc-text-lg);
}

.project-profile-editor h2 {
  margin-bottom: var(--oc-space-1);
  font-size: var(--oc-text-base);
}

.project-profile-editor__form {
  padding-block: var(--oc-space-5);
}

.project-profile-editor__dictionary {
  justify-content: space-between;
  border-top: 1px solid var(--oc-border-muted);
  padding-top: var(--oc-space-5);
}

.project-profile-editor__dictionary > div {
  min-width: 0;
}

.project-profile-editor__repair {
  display: grid;
  grid-template-rows: auto minmax(360px, 1fr);
  gap: var(--oc-space-4);
  min-height: 560px;
  padding-top: var(--oc-space-5);
}

.project-profile-editor__diagnostic {
  align-items: flex-start;
}

.project-profile-editor__diagnostic div {
  display: grid;
  gap: var(--oc-space-1);
}

.project-profile-editor__source {
  min-height: 360px;
  overflow: hidden;
  border: 1px solid var(--oc-border-muted);
}

@media (max-width: 640px) {
  .project-profile-editor__content {
    padding-inline: var(--oc-space-3);
  }

  .project-profile-editor__dictionary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
