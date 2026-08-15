<template>
  <OcDialog class="project-icon-registration-dialog" :open="open"
    :title="t('projectConfig.icons.createPack')" as="form" size="md"
    close-on-backdrop :dismissible="!busy" @request-close="close" @submit="submit">
    <OcOptionGroup
      class="project-icon-registration-dialog__mode-switch"
      :model-value="inputMode"
      :options="inputModeOptions"
      fill
      :columns="2"
      :disabled="busy || isComposing"
      @update:model-value="selectInputMode"
    />

    <section class="project-icon-registration-dialog__summary">
      <template v-if="hasSelectedInput">
        <OcText as="strong">{{ selectedInputSummary }}</OcText>
        <OcText tone="muted" size="sm">{{ iconSetName }} / {{ effectiveKey }}</OcText>
      </template>
      <OcText v-else tone="muted" size="sm">{{ t('projectConfig.icons.chooseFileHint') }}</OcText>
      <div class="project-icon-registration-dialog__summary-actions">
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy || isComposing" @click="pickInput">
          {{ chooseInputLabel }}
        </OcButton>
        <OcButton type="button" variant="ghost" icon="tool.settings"
          :disabled="busy || isComposing" @click="advancedOpen = !advancedOpen">
          {{ advancedOpen ? t('projectConfig.icons.simpleSettings') : t('projectConfig.icons.advancedSettings') }}
        </OcButton>
        <OcButton v-if="inputMode === 'images'" icon-only size="sm" variant="ghost" icon="status.unknown"
          :data-tooltip="t('projectConfig.icons.automaticPackingHelp')"
          :aria-label="t('projectConfig.icons.automaticPackingHelp')" />
      </div>
    </section>

    <template v-if="advancedOpen">
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

      <div v-if="inputMode === 'spritesheet' && hasSelectedInput" class="project-icon-registration-dialog__mode" role="status">
        <OcIcon :name="copyRequired ? 'action.copy' : 'action.check'" size="sm" tone="muted" />
        <OcText as="span" tone="muted" size="sm">
          {{ copyRequired ? t('projectConfig.icons.copyIntoProject') : t('projectConfig.icons.registerProjectFile') }}
        </OcText>
      </div>
    </template>

    <section v-if="inputMode === 'images' && selectedImagePaths.length"
      class="project-icon-registration-dialog__preview" aria-live="polite">
      <div class="project-icon-registration-dialog__preview-heading">
        <OcText as="strong">{{ t('projectConfig.icons.previewTitle') }}</OcText>
        <OcText v-if="previewPending" tone="muted" size="sm">
          <OcIcon name="action.refresh" size="sm" tone="muted" class="project-icon-registration-dialog__spinner" aria-hidden="true" />
          {{ t('projectConfig.icons.previewRendering') }}
        </OcText>
      </div>
      <div v-if="previewUrl" class="project-icon-registration-dialog__preview-image-wrap">
        <img :src="previewUrl" :alt="t('projectConfig.icons.previewTitle')"
          class="project-icon-registration-dialog__preview-image" />
        <OcText v-if="previewComposition" tone="muted" size="sm" mono>
          {{ t('projectConfig.icons.previewStats', {
            width: previewComposition.width,
            height: previewComposition.height,
            utilization: previewUtilization,
          }) }}
        </OcText>
      </div>
      <OcText v-else-if="previewError" tone="danger" size="sm" role="alert">
        {{ previewError }}
      </OcText>
    </section>

    <div v-if="advancedOpen && importConflict && inputMode === 'spritesheet'" class="project-icon-registration-dialog__conflict" role="group"
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

    <OcText v-if="conflictCheckError" tone="danger" size="sm" role="alert">{{ conflictCheckError }}</OcText>
    <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">
      {{ validationMessage }}
    </OcText>
    <OcText v-if="error || localError" tone="danger" size="sm" role="alert">{{ error || localError }}</OcText>

    <template #footer>
      <OcButton type="button" :disabled="busy || isComposing" @click="close">{{ t('projectConfig.icons.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit || busy || isComposing">
        <template #icon>
          <OcIcon v-if="isComposing" name="action.refresh" size="sm" tone="muted" class="project-icon-registration-dialog__spinner" aria-hidden="true" />
        </template>
        {{ isComposing ? t('projectConfig.icons.composing') : t('projectConfig.icons.createPack') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectIconRegistrationRequest = {
  name: string
  key: string
  sourcePath: string
  conflictResolution?: ProjectAssetImportResolution
  generatedSpritesheet?: {
    bytes: Uint8Array
    fileName: string
    icons: readonly ProjectIcon[]
  }
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  createAvailableProjectIconSeriesKey,
  createAvailableProjectIconKey,
  DEFAULT_PROJECT_ICON_DIRECTORY,
  projectIconKeyPattern,
  type ProjectIcon,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import { composeProjectIconSpritesheet } from '../../features/workspace/services/projectIconSpritesheetComposer'
import {
  type ProjectIconSourceImage,
  type ProjectIconSpritesheetComposition,
} from '../../features/workspace/services/projectIconSpritesheetComposer'
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
  defaultOpenPath?: string
  selectFileOnOpen?: boolean
  busy?: boolean
  error?: string
  getManagedIconSource: (path: string) => string | null
  resolveImportConflict: (sourcePath: string, targetDirectory: string) => Promise<ProjectAssetImportConflict | null>
}>(), {
  series: () => [],
  defaultOpenPath: undefined,
  selectFileOnOpen: false,
  busy: false,
  error: '',
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectIconRegistrationRequest]
}>()
type RegistrationDraft = { name: string; key: string; keyEdited: boolean }
const { t } = useI18n()
const inputMode = ref<'spritesheet' | 'images'>('spritesheet')
const advancedOpen = ref(false)
const selectedPath = ref('')
const selectedImagePaths = ref<string[]>([])
const projectSource = ref<string | null>(null)
const copyRequired = ref(false)
const spritesheetDraft = ref<RegistrationDraft>({ name: '', key: '', keyEdited: false })
const imagesDraft = ref<RegistrationDraft>({ name: '', key: '', keyEdited: false })
const importConflict = ref<ProjectAssetImportConflict | null>(null)
const conflictResolution = ref<ProjectAssetImportResolution | null>(null)
const conflictCheckPending = ref(false)
const conflictCheckError = ref('')
const isComposing = ref(false)
const localError = ref('')
const previewComposition = shallowRef<ProjectIconSpritesheetComposition | null>(null)
const previewCompositionKey = ref('')
const previewUrl = ref('')
const previewPending = ref(false)
const previewError = ref('')
let conflictCheckVersion = 0
let previewTimer: ReturnType<typeof setTimeout> | null = null
let previewVersion = 0

const activeDraft = computed(() => inputMode.value === 'spritesheet' ? spritesheetDraft.value : imagesDraft.value)
const iconSetName = computed(() => activeDraft.value.name)
const iconSetKey = computed(() => activeDraft.value.key)
const normalizedName = computed(() => iconSetName.value.trim())
const inputModeOptions = computed<readonly OcOption[]>(() => [
  { value: 'spritesheet', label: t('projectConfig.icons.inputModeSpritesheet') },
  { value: 'images', label: t('projectConfig.icons.inputModeImages') },
])
const hasSelectedInput = computed(() => inputMode.value === 'spritesheet'
  ? Boolean(selectedPath.value)
  : selectedImagePaths.value.length > 0)
const selectedImageSummary = computed(() => selectedImagePaths.value.length
  ? t('projectConfig.icons.selectedImagesCount', { count: selectedImagePaths.value.length })
  : '')
const selectedInputSummary = computed(() => inputMode.value === 'images'
  ? selectedImageSummary.value
  : fileName(selectedPath.value))
const chooseInputLabel = computed(() => hasSelectedInput.value
  ? t('projectConfig.icons.chooseAgain')
  : inputMode.value === 'images'
    ? t('projectConfig.icons.chooseImages')
    : t('projectConfig.icons.chooseFile'))
const activeSourcePath = computed(() => inputMode.value === 'images' ? selectedImagePaths.value[0] ?? '' : selectedPath.value)
const validName = computed(() => normalizedName.value.length > 0)
const generatedKey = computed(() => createAvailableProjectIconSeriesKey(iconSetName.value, props.series))
const effectiveKey = computed(() => iconSetKey.value || generatedKey.value)
const validKey = computed(() => projectIconKeyPattern.test(effectiveKey.value))
const uniqueKey = computed(() => !props.series.some(series => (
  series.key.toLocaleLowerCase() === effectiveKey.value.toLocaleLowerCase()
)))
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
const previewRequestKey = computed(() => JSON.stringify({
  paths: selectedImagePaths.value,
}))
const previewUtilization = computed(() => {
  const composition = previewComposition.value
  if (!composition || composition.width <= 0 || composition.height <= 0) return 0
  const usedArea = composition.icons.reduce((sum, icon) => sum + icon.width * icon.height, 0)
  return Math.round(usedArea / (composition.width * composition.height) * 100)
})
const selectedConflictPath = computed(() => conflictResolution.value === 'use-existing'
  ? importConflict.value?.existingSource ?? ''
  : importConflict.value?.availableCopySource ?? '')
const canSubmit = computed(() => Boolean(
  hasSelectedInput.value
  && validName.value
  && validKey.value
  && uniqueKey.value
  && !conflictCheckPending.value
  && (inputMode.value === 'images' || !importConflict.value || conflictResolution.value)
))
const validationMessage = computed(() => {
  if (!hasSelectedInput.value) return ''
  if (!validName.value) return t('projectConfig.icons.invalidIconSetName')
  if (!validKey.value) return t('projectConfig.icons.invalidIconSetKey')
  if (!uniqueKey.value) return t('projectConfig.icons.iconSetKeyExists')
  return ''
})

watch(() => props.open, open => {
  if (!open) return
  inputMode.value = 'spritesheet'
  advancedOpen.value = false
  selectedPath.value = ''
  selectedImagePaths.value = []
  projectSource.value = null
  copyRequired.value = false
  spritesheetDraft.value = { name: '', key: '', keyEdited: false }
  imagesDraft.value = { name: '', key: '', keyEdited: false }
  isComposing.value = false
  clearPreview()
  localError.value = ''
  conflictCheckError.value = ''
  resetImportConflict()
  if (props.selectFileOnOpen) void pickIconFile().then(selected => {
    if (!selected && !hasSelectedInput.value) emit('close')
  })
}, { immediate: true })

async function pickIconFile(): Promise<boolean> {
  const path = await fileSystemService.pickFile({
    title: t('projectConfig.icons.pickTitle'),
    fileTypeName: t('projectConfig.icons.fileType'),
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    defaultPath: props.defaultOpenPath,
  })
  if (!path) return false
  selectedPath.value = path
  localError.value = ''
  projectSource.value = props.getManagedIconSource(path)
  copyRequired.value = projectSource.value === null
  assignDerivedIdentity(spritesheetDraft.value, path)
  await checkImportConflict()
  return true
}

async function pickInput(): Promise<void> {
  if (inputMode.value === 'images') await pickIconFiles()
  else await pickIconFile()
}

async function pickIconFiles(): Promise<void> {
  if (!fileSystemService.pickFiles) return
  const paths = await fileSystemService.pickFiles({
    title: t('projectConfig.icons.pickImagesTitle'),
    fileTypeName: t('projectConfig.icons.fileType'),
    extensions: ['png', 'jpg', 'jpeg', 'webp'],
    defaultPath: props.defaultOpenPath,
  })
  if (paths.length === 0) return
  selectedImagePaths.value = [...paths]
  localError.value = ''
  assignDerivedIdentity(imagesDraft.value, paths[0] ?? '')
  schedulePreview()
}

function assignDerivedIdentity(draft: RegistrationDraft, path: string): void {
  const name = fileName(path).replace(/\.(?:png|jpe?g|webp)$/i, '')
  draft.name = name
  if (!draft.keyEdited) draft.key = createAvailableProjectIconSeriesKey(name, props.series)
}

function fileName(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/')
  return segments[segments.length - 1] ?? path
}
function updateText(field: 'name' | 'key', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  const draft = activeDraft.value
  if (field === 'name') {
    draft.name = event.target.value
    if (!draft.keyEdited) draft.key = createAvailableProjectIconSeriesKey(draft.name, props.series)
  } else {
    const value = event.target.value
    draft.keyEdited = Boolean(value)
    draft.key = value || createAvailableProjectIconSeriesKey(draft.name, props.series)
  }
}
function selectInputMode(value: string): void {
  if (value !== 'spritesheet' && value !== 'images') return
  inputMode.value = value
  localError.value = ''
  if (value === 'images' && selectedImagePaths.value.length > 0 && !previewComposition.value) schedulePreview()
}

function clearPreview(): void {
  previewVersion += 1
  if (previewTimer !== null) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  if (previewUrl.value && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewComposition.value = null
  previewCompositionKey.value = ''
  previewPending.value = false
  previewError.value = ''
}

function schedulePreview(): void {
  if (inputMode.value !== 'images' || selectedImagePaths.value.length === 0) return
  previewVersion += 1
  const version = previewVersion
  previewPending.value = true
  previewError.value = ''
  clearPreviewResult()
  if (previewTimer !== null) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewTimer = null
    void renderPreview(version, previewRequestKey.value)
  }, 200)
}

function clearPreviewResult(): void {
  if (previewUrl.value && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  previewComposition.value = null
  previewCompositionKey.value = ''
}

async function renderPreview(version: number, requestKey: string): Promise<void> {
  try {
    const images = compositionSources()
    if (version !== previewVersion) return
    const composition = await composeProjectIconSpritesheet(images)
    if (version !== previewVersion) return
    previewUrl.value = typeof URL.createObjectURL === 'function'
      ? URL.createObjectURL(new Blob([composition.bytes as unknown as BlobPart], { type: 'image/png' }))
      : ''
    previewComposition.value = composition
    previewCompositionKey.value = requestKey
    previewPending.value = false
  } catch {
    if (version !== previewVersion) return
    previewPending.value = false
    previewError.value = t('projectConfig.icons.previewFailed')
  }
}
function close(): void {
  if (!props.busy && !isComposing.value) emit('close')
}
async function submit(): Promise<void> {
  if (!canSubmit.value) return
  localError.value = ''
  isComposing.value = true
  if (inputMode.value === 'images') cancelScheduledPreview()
  try {
    const request: ProjectIconRegistrationRequest = {
      name: normalizedName.value,
      key: effectiveKey.value,
      sourcePath: activeSourcePath.value,
      ...(conflictResolution.value ? { conflictResolution: conflictResolution.value } : {}),
    }
    if (inputMode.value === 'images') {
      const generated = previewComposition.value && previewCompositionKey.value === previewRequestKey.value
        ? previewComposition.value
        : await composeProjectIconSpritesheet(compositionSources())
      request.generatedSpritesheet = { bytes: generated.bytes, fileName: 'spritesheet.png', icons: generated.icons }
    }
    emit('submit', request)
  } catch {
    localError.value = t('projectConfig.icons.composeFailed')
  } finally {
    isComposing.value = false
  }
}

function compositionSources(): ProjectIconSourceImage[] {
  const icons: ProjectIcon[] = []
  return selectedImagePaths.value.map(path => {
    const name = fileName(path).replace(/\.(?:png|jpe?g|webp)$/i, '') || 'Icon'
    const iconKey = createAvailableProjectIconKey(name, icons)
    icons.push({ iconKey, name, x: 0, y: 0, width: 1, height: 1 })
    return { path, name, iconKey }
  })
}

function cancelScheduledPreview(): void {
  previewVersion += 1
  if (previewTimer !== null) {
    clearTimeout(previewTimer)
    previewTimer = null
  }
  previewPending.value = false
}

function resetImportConflict(pending = false): void {
  conflictCheckVersion += 1
  importConflict.value = null
  conflictResolution.value = null
  conflictCheckPending.value = pending
  conflictCheckError.value = ''
}

async function checkImportConflict(): Promise<void> {
  if (!selectedPath.value || !copyRequired.value) {
    resetImportConflict()
    return
  }
  const version = ++conflictCheckVersion
  conflictCheckPending.value = true
  try {
    const conflict = await props.resolveImportConflict(selectedPath.value, DEFAULT_PROJECT_ICON_DIRECTORY)
    if (version !== conflictCheckVersion) return
    importConflict.value = conflict
    conflictResolution.value = conflict ? 'rename-copy' : null
  } catch (error) {
    if (version !== conflictCheckVersion) return
    importConflict.value = null
    conflictResolution.value = null
    conflictCheckError.value = t('projectConfig.importConflict.checkFailedWithReason', {
      message: error instanceof Error ? error.message : String(error),
    })
  } finally {
    if (version === conflictCheckVersion) conflictCheckPending.value = false
  }
}

function selectConflictResolution(value: string): void {
  if (value === 'rename-copy' || value === 'use-existing') conflictResolution.value = value
}

onBeforeUnmount(clearPreview)
</script>

<style scoped>
.project-icon-registration-dialog__summary { display: grid; gap: var(--oc-space-1); }
.project-icon-registration-dialog__summary-actions { display: flex; gap: var(--oc-space-2); margin-top: var(--oc-space-2); }
.project-icon-registration-dialog__mode-switch { margin-bottom: var(--oc-space-2); }
.project-icon-registration-dialog__spinner {
  animation: project-icon-registration-dialog-spin calc(var(--oc-duration-slow) * 4) linear infinite;
}
@keyframes project-icon-registration-dialog-spin {
  to { transform: rotate(360deg); }
}
.project-icon-registration-dialog__preview {
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-sm);
  background: var(--oc-bg-inset);
}
.project-icon-registration-dialog__preview { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); }
.project-icon-registration-dialog__preview-heading { display: flex; justify-content: space-between; gap: var(--oc-space-2); }
.project-icon-registration-dialog__preview-image-wrap { display: grid; justify-items: center; gap: var(--oc-space-2); }
.project-icon-registration-dialog__preview-image {
  display: block;
  max-width: 100%;
  max-height: var(--oc-list-max-height-sm);
  object-fit: contain;
  image-rendering: pixelated;
  background: var(--oc-bg-base);
}
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
.project-icon-registration-dialog__field-label {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
}

.project-icon-registration-dialog__file-control > :first-child { min-width: 0; flex: 1; }
.project-icon-registration-dialog__image-list {
  max-height: var(--oc-list-max-height-sm);
  margin: 0;
  padding-left: var(--oc-space-4);
  overflow: auto;
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-xs);
}
.project-icon-registration-dialog__mode { padding-block: var(--oc-space-2); border-block: var(--oc-border-width) solid var(--oc-border-muted); }
.project-icon-registration-dialog__conflict { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); border-radius: var(--oc-radius-sm); background: var(--oc-bg-warning-subtle); }
.project-icon-registration-dialog__conflict p { margin: 0; overflow-wrap: anywhere; }
</style>
