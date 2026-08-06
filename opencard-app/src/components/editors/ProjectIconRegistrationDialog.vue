<template>
  <OcDialog class="project-icon-registration-dialog" :open="open"
    :title="t('projectConfig.icons.createPack')" as="form" size="md"
    min-height="md"
    close-on-backdrop :dismissible="!busy" @request-close="close" @submit="submit">
    <label class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.file') }}</span>
      <span class="project-icon-registration-dialog__file-control">
        <OcFieldInput full-width mono readonly :value="selectedPath"
          :placeholder="t('projectConfig.icons.noFileSelected')" />
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy" @click="pickIconFile">
          {{ t('projectConfig.icons.chooseFile') }}
        </OcButton>
      </span>
    </label>

    <label class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.packName') }}</span>
      <OcFieldInput full-width autofocus :value="iconSetName"
        :aria-invalid="Boolean(selectedPath) && !validName" @input="updateText('name', $event)" />
    </label>
    <label class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.packKey') }}</span>
      <OcFieldInput full-width mono :value="iconSetKey" :placeholder="generatedKey"
        :aria-invalid="Boolean(iconSetKey) && (!validKey || !uniqueKey)" @input="updateText('key', $event)" />
    </label>

    <div v-if="selectedPath" class="project-icon-registration-dialog__mode" role="status">
      <OcIcon :name="copyRequired ? 'action.copy' : 'action.check'" size="sm" tone="muted" />
      <OcText as="span" tone="muted" size="sm">
        {{ copyRequired ? t('projectConfig.icons.copyIntoProject') : t('projectConfig.icons.registerProjectFile') }}
      </OcText>
    </div>

    <label v-if="copyRequired" class="project-icon-registration-dialog__field">
      <span>{{ t('projectConfig.icons.copyDirectory') }}</span>
      <OcFieldInput full-width mono :value="copyDirectory" :aria-invalid="!normalizedCopyDirectory"
        @input="updateText('copyDirectory', $event)" @blur="checkImportConflict" />
    </label>

    <div v-if="importConflict" class="project-icon-registration-dialog__conflict" role="group"
      :aria-label="t('projectConfig.importConflict.title')">
      <OcText as="p" size="sm">
        {{ t('projectConfig.importConflict.message', { path: importConflict.existingSource }) }}
      </OcText>
      <OcOptionGroup :model-value="conflictResolution ?? ''" :options="conflictOptions"
        fill :columns="2" @update:model-value="selectConflictResolution" />
      <OcText v-if="conflictResolution" as="p" tone="muted" size="sm" mono>
        {{ t('projectConfig.importConflict.selectedPath', { path: selectedConflictPath }) }}
      </OcText>
    </div>

    <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">
      {{ validationMessage }}
    </OcText>
    <OcText v-if="error" tone="danger" size="sm" role="alert">{{ error }}</OcText>

    <template #footer>
      <OcButton type="button" :disabled="busy" @click="close">{{ t('projectConfig.icons.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit || busy">
        {{ t('projectConfig.icons.createPack') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectIconRegistrationRequest = {
  name: string
  key: string
  sourcePath: string
  targetDirectory?: string
  conflictResolution?: ProjectAssetImportResolution
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createAvailableProjectIconSeriesKey,
  normalizeProjectIconDirectory,
  projectIconKeyPattern,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import type {
  ProjectAssetImportConflict,
  ProjectAssetImportResolution,
} from '../../features/workspace/store/projectStore'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'

const props = withDefaults(defineProps<{
  open: boolean
  series?: readonly ProjectIconSeries[]
  defaultDirectory: string
  defaultOpenPath?: string
  busy?: boolean
  error?: string
  getRelativeProjectPath: (path: string) => string | null
  resolveImportConflict: (sourcePath: string, targetDirectory: string) => Promise<ProjectAssetImportConflict | null>
}>(), {
  series: () => [],
  defaultOpenPath: undefined,
  busy: false,
  error: '',
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectIconRegistrationRequest]
}>()
const { t } = useI18n()
const selectedPath = ref('')
const projectSource = ref<string | null>(null)
const copyRequired = ref(false)
const copyDirectory = ref('')
const iconSetName = ref('')
const iconSetKey = ref('')
const keyEdited = ref(false)
const importConflict = ref<ProjectAssetImportConflict | null>(null)
const conflictResolution = ref<ProjectAssetImportResolution | null>(null)
const conflictCheckPending = ref(false)
const conflictCheckFailed = ref(false)
let conflictCheckVersion = 0

const normalizedName = computed(() => iconSetName.value.trim())
const validName = computed(() => normalizedName.value.length > 0)
const generatedKey = computed(() => createAvailableProjectIconSeriesKey(iconSetName.value, props.series))
const effectiveKey = computed(() => iconSetKey.value || generatedKey.value)
const validKey = computed(() => projectIconKeyPattern.test(effectiveKey.value))
const uniqueKey = computed(() => !props.series.some(series => (
  series.key.toLocaleLowerCase() === effectiveKey.value.toLocaleLowerCase()
)))
const normalizedCopyDirectory = computed(() => normalizeProjectIconDirectory(copyDirectory.value))
const conflictOptions = computed<readonly OcOption[]>(() => [
  {
    value: 'rename-copy',
    label: t('projectConfig.importConflict.renameCopy', {
      name: fileName(importConflict.value?.availableCopySource ?? ''),
    }),
  },
  {
    value: 'use-existing',
    label: t('projectConfig.importConflict.useExisting', {
      name: fileName(importConflict.value?.existingSource ?? ''),
    }),
  },
])
const selectedConflictPath = computed(() => conflictResolution.value === 'use-existing'
  ? importConflict.value?.existingSource ?? ''
  : importConflict.value?.availableCopySource ?? '')
const canSubmit = computed(() => Boolean(
  selectedPath.value
  && validName.value
  && validKey.value
  && uniqueKey.value
  && (!copyRequired.value || normalizedCopyDirectory.value)
  && !conflictCheckPending.value
  && !conflictCheckFailed.value
  && (!importConflict.value || conflictResolution.value)
))
const validationMessage = computed(() => {
  if (!validName.value) return t('projectConfig.icons.invalidIconSetName')
  if (!validKey.value) return t('projectConfig.icons.invalidIconSetKey')
  if (!uniqueKey.value) return t('projectConfig.icons.iconSetKeyExists')
  if (!selectedPath.value) return ''
  if (copyRequired.value && !normalizedCopyDirectory.value) return t('projectConfig.icons.invalidCopyDirectory')
  if (conflictCheckFailed.value) return t('projectConfig.importConflict.checkFailed')
  return ''
})

watch(() => props.open, open => {
  if (!open) return
  selectedPath.value = ''
  projectSource.value = null
  copyRequired.value = false
  copyDirectory.value = props.defaultDirectory
  iconSetName.value = ''
  iconSetKey.value = ''
  keyEdited.value = false
  resetImportConflict()
}, { immediate: true })

async function pickIconFile(): Promise<void> {
  const path = await fileSystemService.pickFile({
    title: t('projectConfig.icons.pickTitle'),
    fileTypeName: t('projectConfig.icons.fileType'),
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    defaultPath: props.defaultOpenPath,
  })
  if (!path) return
  selectedPath.value = path
  projectSource.value = props.getRelativeProjectPath(path)
  copyRequired.value = projectSource.value === null
  const derivedName = fileName(path).replace(/\.(?:png|jpe?g|webp)$/i, '')
  iconSetName.value = derivedName
  if (!keyEdited.value) iconSetKey.value = ''
  await checkImportConflict()
}

function fileName(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/')
  return segments[segments.length - 1] ?? path
}
function updateText(field: 'copyDirectory' | 'name' | 'key', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'copyDirectory') {
    copyDirectory.value = event.target.value
    resetImportConflict(Boolean(selectedPath.value && copyRequired.value))
  }
  else if (field === 'name') {
    iconSetName.value = event.target.value
    if (!keyEdited.value) iconSetKey.value = ''
  } else {
    iconSetKey.value = event.target.value
    keyEdited.value = true
  }
}
function close(): void {
  if (!props.busy) emit('close')
}
function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    name: normalizedName.value,
    key: effectiveKey.value,
    sourcePath: selectedPath.value,
    ...(copyRequired.value && normalizedCopyDirectory.value
      ? { targetDirectory: normalizedCopyDirectory.value }
      : {}),
    ...(conflictResolution.value ? { conflictResolution: conflictResolution.value } : {}),
  })
}

function resetImportConflict(pending = false): void {
  conflictCheckVersion += 1
  importConflict.value = null
  conflictResolution.value = null
  conflictCheckPending.value = pending
  conflictCheckFailed.value = false
}

async function checkImportConflict(): Promise<void> {
  const targetDirectory = normalizedCopyDirectory.value
  if (!selectedPath.value || !copyRequired.value || !targetDirectory) {
    resetImportConflict()
    return
  }
  const version = ++conflictCheckVersion
  conflictCheckPending.value = true
  conflictCheckFailed.value = false
  try {
    const conflict = await props.resolveImportConflict(selectedPath.value, targetDirectory)
    if (version !== conflictCheckVersion) return
    importConflict.value = conflict
    conflictResolution.value = null
  } catch {
    if (version !== conflictCheckVersion) return
    importConflict.value = null
    conflictResolution.value = null
    conflictCheckFailed.value = true
  } finally {
    if (version === conflictCheckVersion) conflictCheckPending.value = false
  }
}

function selectConflictResolution(value: string): void {
  if (value === 'rename-copy' || value === 'use-existing') conflictResolution.value = value
}
</script>

<style scoped>
.project-icon-registration-dialog__mode,
.project-icon-registration-dialog__file-control {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.project-icon-registration-dialog__field {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-2);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.project-icon-registration-dialog__file-control > :first-child { min-width: 0; flex: 1; }
.project-icon-registration-dialog__mode { padding-block: var(--oc-space-2); border-block: var(--oc-border-width) solid var(--oc-border-muted); }
.project-icon-registration-dialog__conflict { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); border-radius: var(--oc-radius-sm); background: var(--oc-bg-warning-subtle); }
.project-icon-registration-dialog__conflict p { margin: 0; overflow-wrap: anywhere; }
</style>
