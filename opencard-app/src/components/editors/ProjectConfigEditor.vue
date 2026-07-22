<template>
  <section class="project-config-editor" :aria-label="t('projectConfig.title')" @keydown.ctrl.s.prevent="save">
    <header class="project-config-editor__header">
      <OcIcon name="file.opencard-project" size="lg" />
      <div>
        <h1>{{ t('projectConfig.title') }}</h1>
        <OcText tone="muted" size="sm">{{ filePath }}</OcText>
      </div>
      <OcButton
        v-if="metadata"
        class="project-config-editor__add-property"
        icon="action.add"
        variant="ghost"
        @click="openAdditionalFieldDialog"
      >
        {{ t('projectConfig.actions.addProperty') }}
      </OcButton>
    </header>

    <div v-if="metadata" class="project-config-editor__form">
      <PropertyEditor
        :inputs="propertyInputs"
        :categories="propertyCategories"
        sort-mode="category"
        @update-property="updateProperty"
        @add-property="updateProperty"
        @delete-property="deleteAdditionalField"
      />
    </div>

    <div v-else class="project-config-editor__invalid" role="alert">
      <OcIcon name="status.error" tone="danger" size="lg" />
      <OcText>{{ t('projectConfig.invalid') }}</OcText>
    </div>

    <AdditionalFieldCreateDialog
      :open="additionalFieldDialogOpen"
      :field-types="additionalFieldTypes"
      :field-type="additionalFieldDraft.fieldType"
      :field-key="additionalFieldDraft.fieldKey"
      :title="additionalFieldDraft.title"
      :error-text="additionalFieldErrorText"
      :invalid="Boolean(additionalFieldError)"
      @update-field-type="additionalFieldDraft.fieldType = $event as ProjectAdditionalFieldType"
      @update-field-key="additionalFieldDraft.fieldKey = $event"
      @update-title="additionalFieldDraft.title = $event"
      @close="additionalFieldDialogOpen = false"
      @submit="submitAdditionalField"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import {
  createProjectAdditionalField,
  deleteProjectAdditionalField,
  parseProjectMetadataText,
  projectPropertySchema,
  serializeProjectMetadata,
  type ProjectMetadata,
} from '../../features/workspace/model/projectMetadata'
import {
  createPropertyDefaultValue,
  additionalFieldTypes,
  parseAdditionalFieldDefinitions,
  propertyEditorCategoryDefinitions,
  type EditorPropertyDefinition,
  type AdditionalFieldKeyError,
} from '../../entities/card/schema'
import { validateAdditionalFieldKey } from '../../entities/card/schema'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import AdditionalFieldCreateDialog from '../../shared/ui/property-editor/AdditionalFieldCreateDialog.vue'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorFieldDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
  PropertyEditorFieldIntent,
} from '../../shared/ui/property-editor/propertyEditor.types'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t, te } = useI18n()
const metadata = ref<ProjectMetadata | null>(null)
const projectCategoryIds = ['identity', 'content', 'data', 'custom'] as const
type ProjectAdditionalFieldType = (typeof additionalFieldTypes)[number]
const additionalFieldDialogOpen = ref(false)
const additionalFieldDraft = ref({
  fieldKey: '',
  fieldType: additionalFieldTypes[0] as ProjectAdditionalFieldType,
  title: '',
})

const additionalFieldError = computed<AdditionalFieldKeyError | 'invalid-target' | null>(() => {
  if (!metadata.value) return 'invalid-target'
  if (!additionalFieldTypes.includes(additionalFieldDraft.value.fieldType)) {
    return 'unsupported-field-type'
  }
  return validateAdditionalFieldKey(
    metadata.value.project,
    Object.keys(projectPropertySchema),
    additionalFieldDraft.value.fieldKey,
  )
})
const additionalFieldErrorText = computed(() => {
  const error = additionalFieldError.value
  if (!error || error === 'invalid-target') return ''
  const messageKey = `propertyEditor.customFields.errors.${error}`
  return te(messageKey) ? t(messageKey) : error
})

const propertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() =>
  new Map(projectCategoryIds.map((categoryId) => [
    categoryId,
    {
      title: t(`propertyEditor.categories.${categoryId}`),
      icon: propertyEditorCategoryDefinitions[categoryId].icon,
    },
  ])),
)

const propertyInputs = computed<readonly PropertyEditorInput[]>(() => {
  if (!metadata.value) return []

  const project = metadata.value.project
  const additionalDefinitions = parseAdditionalFieldDefinitions(
    project.additionalFieldDefinition,
    Object.keys(projectPropertySchema),
  )
  const fields: Record<string, PropertyEditorFieldDefinition> = {}

  for (const [fieldKey, definition] of Object.entries(projectPropertySchema)) {
    fields[fieldKey] = toPropertyEditorDefinition(
      definition,
      t(`projectConfig.fields.${fieldKey}`),
    )
  }
  for (const [fieldKey, definition] of Object.entries(additionalDefinitions)) {
    fields[fieldKey] = toPropertyEditorDefinition(
      {
        fieldType: definition.fieldType,
        acceptsBinding: false,
        categoryId: 'custom',
      } as EditorPropertyDefinition,
      definition.title ?? fieldKey,
    )
    fields[fieldKey] = { ...fields[fieldKey], deletable: true } as PropertyEditorFieldDefinition
  }

  return [{
    key: 'project',
    title: project.name || t('projectConfig.title'),
    record: project,
    fields,
  }]
})

watch(
  () => props.modelValue,
  (content) => {
    metadata.value = parseProjectMetadataText(content ?? '')
  },
  { immediate: true },
)

function toPropertyEditorDefinition(
  source: EditorPropertyDefinition,
  title: string,
): PropertyEditorFieldDefinition {
  const {
    categoryId,
    displayFieldKey: _displayFieldKey,
    autocomplete,
    extensionsFilter: _extensionsFilter,
    objectType: _objectType,
    ...definition
  } = source as EditorPropertyDefinition & {
    autocomplete?: readonly string[]
    extensionsFilter?: readonly string[]
    objectType?: string
  }
  return {
    ...definition,
    title,
    category: categoryId,
    defaultValue: createPropertyDefaultValue(source),
    ...(autocomplete?.length
      ? { completion: { static: { values: autocomplete, presentation: 'ghost' as const } } }
      : {}),
  } as PropertyEditorFieldDefinition
}

function updateProperty(payload: PropertyEditorMutation): void {
  if (!metadata.value || payload.key !== 'project') return
  const nextMetadata: ProjectMetadata = {
    ...metadata.value,
    project: {
      ...metadata.value.project,
      [payload.fieldKey]: payload.value,
    },
  }
  metadata.value = nextMetadata
  emit('update:modelValue', serializeProjectMetadata(nextMetadata))
}

function openAdditionalFieldDialog(): void {
  additionalFieldDraft.value = {
    fieldKey: '',
    fieldType: additionalFieldTypes[0] as ProjectAdditionalFieldType,
    title: '',
  }
  additionalFieldDialogOpen.value = true
}

function cloneProjectForMutation(): ProjectMetadata['project'] | null {
  if (!metadata.value) return null
  return {
    ...metadata.value.project,
    ...(metadata.value.project.additionalFieldDefinition
      ? {
          additionalFieldDefinition: Object.fromEntries(
            Object.entries(metadata.value.project.additionalFieldDefinition)
              .map(([fieldKey, definition]) => [fieldKey, { ...definition }]),
          ),
        }
      : {}),
  }
}

function commitProject(project: ProjectMetadata['project']): void {
  if (!metadata.value) return
  const nextMetadata: ProjectMetadata = { ...metadata.value, project }
  metadata.value = nextMetadata
  emit('update:modelValue', serializeProjectMetadata(nextMetadata))
}

function submitAdditionalField(): void {
  const project = cloneProjectForMutation()
  if (!project || additionalFieldError.value) return
  const result = createProjectAdditionalField(
    project,
    additionalFieldDraft.value.fieldKey,
    additionalFieldDraft.value.fieldType,
    additionalFieldDraft.value.title,
  )
  if (result) return
  commitProject(project)
  additionalFieldDialogOpen.value = false
}

function deleteAdditionalField(payload: PropertyEditorFieldIntent): void {
  if (payload.key !== 'project') return
  const project = cloneProjectForMutation()
  if (!project || !deleteProjectAdditionalField(project, payload.fieldKey)) return
  commitProject(project)
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

.project-config-editor__add-property {
  margin-left: auto;
  flex: 0 0 auto;
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

.project-config-editor__invalid {
  display: flex;
  align-items: center;
  gap: var(--oc-space-3);
  padding-block: var(--oc-space-5);
}

</style>
