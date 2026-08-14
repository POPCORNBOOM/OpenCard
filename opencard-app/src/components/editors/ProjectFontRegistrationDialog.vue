<template>
  <OcDialog class="project-font-dialog" :open="open" :title="dialogTitle" as="form" size="md" min-height="md"
    close-on-backdrop :dismissible="!busy" @request-close="close" @submit="submit">
    <label class="project-font-dialog__field">
      <span>{{ t('projectConfig.fonts.file') }}</span>
      <span class="project-font-dialog__file-control">
        <OcFieldInput full-width mono readonly :value="selectedPath" :aria-invalid="!selectedPath"
          :placeholder="t('projectConfig.fonts.noFileSelected')" />
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy" @click="pickFontFile">
          {{ t('projectConfig.fonts.chooseFile') }}
        </OcButton>
      </span>
    </label>

    <label class="project-font-dialog__field">
      <span>{{ t('projectConfig.fonts.name') }}</span>
      <OcFieldInput full-width :value="fontName"
        :aria-invalid="Boolean(selectedPath) && !fontName.trim()" @input="updateText('name', $event)" />
    </label>

    <label class="project-font-dialog__field">
      <span>{{ t('projectConfig.fonts.key') }}</span>
      <OcFieldInput full-width mono :value="fontKey" :placeholder="generatedKey"
        :aria-invalid="Boolean(fontKey) && (!validKey || !uniqueKey)"
        @input="updateText('key', $event)" />
    </label>

    <div v-if="selectedPath" class="project-font-dialog__mode" role="status">
      <OcIcon :name="copyRequired ? 'action.copy' : 'action.check'" size="sm" tone="muted" />
      <OcText as="span" tone="muted" size="sm">
        {{ copyRequired ? t('projectConfig.fonts.copyIntoProject') : t('projectConfig.fonts.registerProjectFile') }}
      </OcText>
    </div>

    <OcButton type="button" variant="ghost" icon="tool.settings" @click="advancedOpen = !advancedOpen">
      {{ t('projectConfig.fonts.advancedFace') }}
    </OcButton>
    <div v-if="advancedOpen" class="project-font-dialog__advanced">
      <label class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.weightRange') }}</span>
        <span class="project-font-dialog__range">
          <OcFieldInput type="number" :value="String(weightMin)" @input="updateNumber('weightMin', $event)" />
          <OcFieldInput type="number" :value="String(weightMax)" @input="updateNumber('weightMax', $event)" />
        </span>
      </label>
      <label class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.stretchRange') }}</span>
        <span class="project-font-dialog__range">
          <OcFieldInput type="number" :value="String(stretchMin)" @input="updateNumber('stretchMin', $event)" />
          <OcFieldInput type="number" :value="String(stretchMax)" @input="updateNumber('stretchMax', $event)" />
        </span>
      </label>
      <label class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.faceStyle') }}</span>
        <OcSelect v-model="styleKind" full-width :options="styleOptions" />
      </label>
      <label v-if="styleKind === 'oblique'" class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.obliqueAngle') }}</span>
        <span class="project-font-dialog__range">
          <OcFieldInput type="number" :value="String(angleMin)" @input="updateNumber('angleMin', $event)" />
          <OcFieldInput type="number" :value="String(angleMax)" @input="updateNumber('angleMax', $event)" />
        </span>
      </label>
    </div>

    <div v-if="importConflict" class="project-font-dialog__conflict" role="group"
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

    <OcText v-if="validationMessage" class="project-font-dialog__error" tone="danger" size="sm" role="alert">
      {{ validationMessage }}
    </OcText>
    <OcText v-if="error" class="project-font-dialog__error" tone="danger" size="sm" role="alert">
      {{ error }}
    </OcText>

    <template #footer>
      <OcButton type="button" :disabled="busy" @click="close">
        {{ t('projectConfig.fonts.cancel') }}
      </OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit || busy">
        {{ submitLabel }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectFontFamilyRegistrationRequest = {
  originalKey?: string
  key: string
  name: string
  sourcePath: string
  weight: NumericRange
  stretch: NumericRange
  style: ProjectFontFaceStyle
  conflictResolution?: ProjectAssetImportResolution
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type {
  NumericRange,
  ProjectFontFaceStyle,
  ProjectFontRegistry,
} from '../../features/workspace/model/projectFontRegistry'
import type {
  ProjectAssetImportConflict,
  ProjectAssetImportResolution,
} from '../../features/workspace/store/projectStore'
import {
  DEFAULT_PROJECT_FONT_DIRECTORY,
  projectFontIdPattern,
} from '../../features/workspace/model/projectFonts'
import { createAvailableKey } from '../../shared/model/keySlug'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import OcSelect from '../standard/OcSelect.vue'

const props = withDefaults(defineProps<{
  open: boolean
  registry?: ProjectFontRegistry
  reservedKeys?: readonly string[]
  originalKey?: string
  defaultOpenPath?: string
  busy?: boolean
  error?: string
  getRelativeProjectPath: (path: string) => string | null
  resolveImportConflict: (sourcePath: string, targetDirectory: string) => Promise<ProjectAssetImportConflict | null>
}>(), {
  registry: () => ({}),
  reservedKeys: () => [],
  originalKey: undefined,
  defaultOpenPath: undefined,
  busy: false,
  error: '',
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectFontFamilyRegistrationRequest]
}>()
const { t } = useI18n()
const selectedPath = ref('')
const projectSource = ref<string | null>(null)
const copyRequired = ref(false)
const fontKey = ref('')
const fontName = ref('')
const importConflict = ref<ProjectAssetImportConflict | null>(null)
const conflictResolution = ref<ProjectAssetImportResolution | null>(null)
const conflictCheckPending = ref(false)
const conflictCheckFailed = ref(false)
const advancedOpen = ref(false)
const weightMin = ref(400)
const weightMax = ref(400)
const stretchMin = ref(100)
const stretchMax = ref(100)
const styleKind = ref<'normal' | 'italic' | 'oblique'>('normal')
const angleMin = ref(14)
const angleMax = ref(14)
let conflictCheckVersion = 0

const editing = computed(() => Boolean(props.originalKey))
const generatedKey = computed(() => createAvailableKey(
  fontName.value,
  [...Object.keys(props.registry), ...props.reservedKeys]
    .filter(key => key.toLocaleLowerCase() !== props.originalKey?.toLocaleLowerCase()),
  'font',
))
const effectiveKey = computed(() => fontKey.value || generatedKey.value)
const validKey = computed(() => projectFontIdPattern.test(effectiveKey.value))
const uniqueKey = computed(() => ![...Object.keys(props.registry), ...props.reservedKeys].some(key => (
  key.toLocaleLowerCase() === effectiveKey.value.toLocaleLowerCase()
  && key.toLocaleLowerCase() !== props.originalKey?.toLocaleLowerCase()
)))
const conflictOptions = computed<readonly OcOption[]>(() => [
  {
    value: 'rename-copy',
    label: t('projectConfig.importConflict.renameCopy', {
      name: projectAssetName(importConflict.value?.availableCopySource ?? ''),
    }),
  },
  {
    value: 'use-existing',
    label: t('projectConfig.importConflict.useExisting', {
      name: projectAssetName(importConflict.value?.existingSource ?? ''),
    }),
  },
])
const styleOptions = computed(() => [
  { value: 'normal', label: t('projectConfig.fonts.styleNormal') },
  { value: 'italic', label: t('projectConfig.fonts.styleItalic') },
  { value: 'oblique', label: t('projectConfig.fonts.styleOblique') },
])
const selectedConflictPath = computed(() => conflictResolution.value === 'use-existing'
  ? importConflict.value?.existingSource ?? ''
  : importConflict.value?.availableCopySource ?? '')
const canSubmit = computed(() => Boolean(
  selectedPath.value
  && fontName.value.trim()
  && validKey.value
  && uniqueKey.value
  && !conflictCheckPending.value
      && !conflictCheckFailed.value
      && (!importConflict.value || conflictResolution.value)
      && validDescriptors.value
))
const validDescriptors = computed(() => weightMin.value >= 1 && weightMax.value <= 1000
  && weightMin.value <= weightMax.value
  && stretchMin.value > 0 && stretchMax.value <= 1000 && stretchMin.value <= stretchMax.value
  && (styleKind.value !== 'oblique'
    || (angleMin.value >= -90 && angleMax.value <= 90 && angleMin.value <= angleMax.value)))
const dialogTitle = computed(() => editing.value
  ? t('projectConfig.fonts.configure')
  : t('projectConfig.fonts.register'))
const submitLabel = computed(() => editing.value
  ? t('projectConfig.fonts.save')
  : t('projectConfig.fonts.confirmRegister'))
const validationMessage = computed(() => {
  if (!selectedPath.value) return t('projectConfig.fonts.fileRequired')
  if (!uniqueKey.value) return t('projectConfig.fonts.keyExists')
  if (fontKey.value && !validKey.value) return t('projectConfig.fonts.invalidKey')
  if (!fontName.value.trim()) return t('projectConfig.fonts.nameRequired')
  if (!validDescriptors.value) return t('projectConfig.fonts.invalidFaceDescriptors')
  if (conflictCheckFailed.value) return t('projectConfig.importConflict.checkFailed')
  return ''
})

watch([() => props.open, () => props.originalKey], ([open]) => {
  if (!open) return
  const entry = props.originalKey ? props.registry[props.originalKey] : undefined
  const definition = entry?.kind === 'family' ? entry.family : undefined
  const face = definition?.faces[0]
  selectedPath.value = face?.source ?? ''
  projectSource.value = face?.source ?? null
  copyRequired.value = false
  fontKey.value = props.originalKey ?? ''
  fontName.value = definition?.name ?? ''
  weightMin.value = face?.weight.min ?? 400
  weightMax.value = face?.weight.max ?? 400
  stretchMin.value = face?.stretch.min ?? 100
  stretchMax.value = face?.stretch.max ?? 100
  styleKind.value = face?.style.kind ?? 'normal'
  angleMin.value = face?.style.kind === 'oblique' ? face.style.angle.min : 14
  angleMax.value = face?.style.kind === 'oblique' ? face.style.angle.max : 14
  advancedOpen.value = Boolean(face && (
    face.weight.min !== 400 || face.weight.max !== 400
    || face.stretch.min !== 100 || face.stretch.max !== 100 || face.style.kind !== 'normal'
  ))
  resetImportConflict()
}, { immediate: true })

async function pickFontFile(): Promise<void> {
  const path = await fileSystemService.pickFile({
    title: t('projectConfig.fonts.pickTitle'),
    fileTypeName: t('projectConfig.fonts.fileType'),
    extensions: ['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'],
    defaultPath: props.defaultOpenPath,
  })
  if (!path) return
  selectedPath.value = path
  fontName.value = fontNameFromPath(path)
  projectSource.value = props.getRelativeProjectPath(path)
  copyRequired.value = projectSource.value === null
  await checkImportConflict()
}

function updateText(field: 'key' | 'name', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'key') fontKey.value = event.target.value
  else fontName.value = event.target.value
}

function close(): void {
  if (!props.busy) emit('close')
}

function submit(): void {
  if (!canSubmit.value) return
  emit('submit', {
    ...(props.originalKey ? { originalKey: props.originalKey } : {}),
    key: effectiveKey.value,
    name: fontName.value.trim(),
    sourcePath: selectedPath.value,
    weight: { min: weightMin.value, max: weightMax.value },
    stretch: { min: stretchMin.value, max: stretchMax.value },
    style: styleKind.value === 'oblique'
      ? { kind: 'oblique', angle: { min: angleMin.value, max: angleMax.value } }
      : { kind: styleKind.value },
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
  if (!selectedPath.value || !copyRequired.value) {
    resetImportConflict()
    return
  }
  const version = ++conflictCheckVersion
  conflictCheckPending.value = true
  conflictCheckFailed.value = false
  try {
    const conflict = await props.resolveImportConflict(selectedPath.value, DEFAULT_PROJECT_FONT_DIRECTORY)
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

function updateNumber(
  field: 'weightMin' | 'weightMax' | 'stretchMin' | 'stretchMax' | 'angleMin' | 'angleMax',
  event: Event,
): void {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number(event.target.value)
  if (!Number.isFinite(value)) return
  if (field === 'weightMin') weightMin.value = value
  else if (field === 'weightMax') weightMax.value = value
  else if (field === 'stretchMin') stretchMin.value = value
  else if (field === 'stretchMax') stretchMax.value = value
  else if (field === 'angleMin') angleMin.value = value
  else angleMax.value = value
}

function projectAssetName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

function fontNameFromPath(path: string): string {
  const name = projectAssetName(path)
  return name.replace(/\.(?:woff2?|ttf|otf|ttc|otc)$/i, '')
}
</script>

<style scoped>
.project-font-dialog__mode,
.project-font-dialog__file-control {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.project-font-dialog__field { display: grid; min-width: 0; gap: var(--oc-space-2); color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.project-font-dialog__advanced { display: grid; gap: var(--oc-space-3); }
.project-font-dialog__range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--oc-space-2); }
.project-font-dialog__file-control > :first-child { min-width: 0; flex: 1; }
.project-font-dialog__mode { padding-block: var(--oc-space-2); border-block: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-dialog__error { margin: 0; }
.project-font-dialog__conflict { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); border-radius: var(--oc-radius-sm); background: var(--oc-bg-warning-subtle); }
.project-font-dialog__conflict p { margin: 0; overflow-wrap: anywhere; }
</style>
