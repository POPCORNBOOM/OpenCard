<template>
  <OcDialog class="project-font-dialog" :open="open" :title="dialogTitle" as="form" size="md"
    close-on-backdrop :dismissible="!busy" @request-close="close" @submit="submit">
    <section v-if="!advancedOpen" class="project-font-dialog__summary">
      <template v-if="selectedSourceCount > 0">
        <div class="project-font-dialog__summary-heading">
          <OcIcon name="action.check" tone="success" />
          <div>
            <OcText as="strong">{{ t('projectConfig.fonts.selectedFiles', { count: selectedSourceCount }) }}</OcText>
            <OcText as="div" tone="muted" size="sm">{{ t('projectConfig.fonts.detectedFamilies', { count: familyDrafts.length }) }}</OcText>
          </div>
        </div>
        <div class="project-font-dialog__summary-list">
          <div v-for="family in familyDrafts" :key="family.id" class="project-font-dialog__summary-family">
            <OcText as="strong" size="sm">{{ family.name || t('projectConfig.fonts.unnamedFamily') }}</OcText>
            <OcText as="span" tone="muted" size="sm">
              {{ family.faces.map(face => face.faceName || projectAssetName(face.sourcePath)).join(' · ') }}
            </OcText>
          </div>
        </div>
      </template>
      <OcText v-else tone="muted" size="sm">{{ t('projectConfig.fonts.chooseFilesHint') }}</OcText>
      <div class="project-font-dialog__summary-actions">
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy"
          @click="pickFontFile(true, selectedSourceCount > 0)">
          {{ selectedSourceCount > 0 ? t('projectConfig.fonts.chooseAgain') : t('projectConfig.fonts.chooseFiles') }}
        </OcButton>
        <OcButton v-if="selectedSourceCount > 0" type="button" variant="ghost" icon="tool.settings"
          @click="advancedOpen = true">
          {{ t('projectConfig.fonts.advancedFace') }}
        </OcButton>
      </div>
    </section>

    <OcButton v-if="advancedOpen && !editing" type="button" variant="ghost" icon="nav.arrow-left"
      @click="advancedOpen = false">
      {{ t('projectConfig.fonts.simpleSettings') }}
    </OcButton>

    <section v-if="advancedOpen && familyDrafts.length > 1" class="project-font-dialog__families">
      <OcText as="strong" size="sm">{{ t('projectConfig.fonts.importedFamilies') }}</OcText>
      <div class="project-font-dialog__family-list">
        <OcButton v-for="(family, index) in familyDrafts" :key="family.id" type="button" variant="ghost"
          :aria-current="index === activeFamilyIndex" @click="selectFamily(index)">
          {{ family.name || t('projectConfig.fonts.unnamedFamily') }}
        </OcButton>
      </div>
    </section>

    <template v-if="advancedOpen">
      <label class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.name') }}</span>
        <OcFieldInput full-width :value="fontName" :aria-invalid="Boolean(faces.length) && !fontName.trim()"
          @input="updateText('name', $event)" />
      </label>

      <label class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.key') }}</span>
        <OcFieldInput full-width mono :value="fontKey" :placeholder="generatedKey"
          :aria-invalid="Boolean(fontKey) && (!validKey || !uniqueKey)"
          @input="updateText('key', $event)" />
      </label>
    </template>

    <section v-if="advancedOpen" class="project-font-dialog__faces">
      <header class="project-font-dialog__faces-header">
        <OcText as="strong" size="sm">{{ t('projectConfig.fonts.faces') }}</OcText>
        <OcButton type="button" icon="action.add" variant="soft" :disabled="busy" @click="pickFontFile(true)">
          {{ t('projectConfig.fonts.addFace') }}
        </OcButton>
      </header>
      <div v-if="faces.length" class="project-font-dialog__face-list">
        <div v-for="(face, index) in faces" :key="face.id" class="project-font-dialog__face-row">
          <OcButton type="button" variant="ghost" :aria-current="index === activeFaceIndex"
            @click="activeFaceIndex = index">
            {{ face.faceName || projectAssetName(face.sourcePath) }}
          </OcButton>
          <OcButton type="button" icon-only variant="ghost" icon="action.delete" icon-tone="danger"
            :aria-label="t('projectConfig.fonts.removeFace')" @click="removeFace(index)" />
        </div>
      </div>
      <OcText v-else tone="muted" size="sm">{{ t('projectConfig.fonts.noFaces') }}</OcText>
    </section>

    <template v-if="advancedOpen && activeFace">
      <label class="project-font-dialog__field">
        <span>{{ t('projectConfig.fonts.file') }}</span>
        <span class="project-font-dialog__file-control">
          <OcFieldInput full-width mono readonly :value="activeFace.sourcePath"
            :placeholder="t('projectConfig.fonts.noFileSelected')" />
          <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy" @click="pickFontFile(false)">
            {{ t('projectConfig.fonts.replaceFaceFile') }}
          </OcButton>
        </span>
      </label>

      <div class="project-font-dialog__mode" role="status">
        <OcIcon :name="activeFace.copyRequired ? 'action.copy' : 'action.check'" size="sm" tone="muted" />
        <OcText as="span" tone="muted" size="sm">
          {{ activeFace.copyRequired
            ? t('projectConfig.fonts.copyIntoProject')
            : t('projectConfig.fonts.registerProjectFile') }}
        </OcText>
      </div>

      <div class="project-font-dialog__advanced">
        <label class="project-font-dialog__field">
          <span>{{ t('projectConfig.fonts.weightRange') }}</span>
          <span class="project-font-dialog__range">
            <OcFieldInput type="number" :value="String(activeFace.weight.min)"
              @input="updateRange('weight', 'min', $event)" />
            <OcFieldInput type="number" :value="String(activeFace.weight.max)"
              @input="updateRange('weight', 'max', $event)" />
          </span>
        </label>
        <label class="project-font-dialog__field">
          <span>{{ t('projectConfig.fonts.stretchRange') }}</span>
          <span class="project-font-dialog__range">
            <OcFieldInput type="number" :value="String(activeFace.stretch.min)"
              @input="updateRange('stretch', 'min', $event)" />
            <OcFieldInput type="number" :value="String(activeFace.stretch.max)"
              @input="updateRange('stretch', 'max', $event)" />
          </span>
        </label>
        <label class="project-font-dialog__field">
          <span>{{ t('projectConfig.fonts.faceStyle') }}</span>
          <OcSelect :model-value="activeFace.style.kind" full-width :options="styleOptions"
            @update:model-value="updateStyleKind" />
        </label>
        <label v-if="activeFace.style.kind === 'oblique'" class="project-font-dialog__field">
          <span>{{ t('projectConfig.fonts.obliqueAngle') }}</span>
          <span class="project-font-dialog__range">
            <OcFieldInput type="number" :value="String(activeFace.style.angle.min)"
              @input="updateAngle('min', $event)" />
            <OcFieldInput type="number" :value="String(activeFace.style.angle.max)"
              @input="updateAngle('max', $event)" />
          </span>
        </label>
      </div>

      <div v-if="activeFace.importConflict" class="project-font-dialog__conflict" role="group"
        :aria-label="t('projectConfig.importConflict.title')">
        <OcText as="p" size="sm">
          {{ t('projectConfig.importConflict.message', { path: activeFace.importConflict.existingSource }) }}
        </OcText>
        <OcOptionGroup :model-value="activeFace.conflictResolution ?? ''" :options="conflictOptions"
          fill :columns="2" @update:model-value="selectConflictResolution" />
        <OcText v-if="activeFace.conflictResolution" as="p" tone="muted" size="sm" mono>
          {{ t('projectConfig.importConflict.selectedPath', { path: selectedConflictPath }) }}
        </OcText>
      </div>
    </template>

    <OcText v-if="validationMessage && (advancedOpen || selectedSourceCount > 0 || metadataError)"
      class="project-font-dialog__error" tone="danger" size="sm" role="alert">
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
export type ProjectFontFamilyFaceRequest = {
  originalSource?: string
  sourcePath: string
  collectionIndex?: number
  weight: NumericRange
  stretch: NumericRange
  style: ProjectFontFaceStyle
  conflictResolution?: ProjectAssetImportResolution
}

export type ProjectFontFamilyRegistrationRequest = {
  families: Array<{
    originalKey?: string
    key: string
    name: string
    faces: ProjectFontFamilyFaceRequest[]
  }>
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
import { findOverlappingProjectFontFaces } from '../../features/workspace/model/projectFontRegistry'
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
import { inspectProjectFontSource } from '../../features/workspace/services/projectFontMetadata'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'
import OcOptionGroup, { type OcOption } from '../standard/OcOptionGroup.vue'
import OcSelect from '../standard/OcSelect.vue'

type FaceDraft = ProjectFontFamilyFaceRequest & {
  id: number
  faceName: string
  copyRequired: boolean
  importConflict: ProjectAssetImportConflict | null
  conflictCheckPending: boolean
  conflictCheckFailed: boolean
}
type FamilyDraft = {
  id: number
  originalKey?: string
  key: string
  name: string
  faces: FaceDraft[]
  activeFaceIndex: number
}

const props = withDefaults(defineProps<{
  open: boolean
  registry?: ProjectFontRegistry
  reservedKeys?: readonly string[]
  originalKey?: string
  selectFilesOnOpen?: boolean
  defaultOpenPath?: string
  busy?: boolean
  error?: string
  getManagedFontSource: (path: string) => string | null
  resolveImportConflict: (sourcePath: string, targetDirectory: string) => Promise<ProjectAssetImportConflict | null>
}>(), {
  registry: () => ({}),
  reservedKeys: () => [],
  originalKey: undefined,
  selectFilesOnOpen: false,
  defaultOpenPath: undefined,
  busy: false,
  error: '',
})
const emit = defineEmits<{
  close: []
  submit: [request: ProjectFontFamilyRegistrationRequest]
}>()
const { t } = useI18n()
const familyDrafts = ref<FamilyDraft[]>([])
const activeFamilyIndex = ref(0)
const activeFamily = computed(() => familyDrafts.value[activeFamilyIndex.value] ?? null)
const fontKey = computed({
  get: () => activeFamily.value?.key ?? '',
  set: value => { if (activeFamily.value) activeFamily.value.key = value },
})
const fontName = computed({
  get: () => activeFamily.value?.name ?? '',
  set: value => { if (activeFamily.value) activeFamily.value.name = value },
})
const faces = computed({
  get: () => activeFamily.value?.faces ?? [],
  set: value => { if (activeFamily.value) activeFamily.value.faces = value },
})
const activeFaceIndex = computed({
  get: () => activeFamily.value?.activeFaceIndex ?? -1,
  set: value => { if (activeFamily.value) activeFamily.value.activeFaceIndex = value },
})
const advancedOpen = ref(false)
const metadataError = ref('')
let nextFaceId = 1
let nextFamilyId = 1

const editing = computed(() => Boolean(props.originalKey))
const selectedSourceCount = computed(() => new Set(
  familyDrafts.value.flatMap(family => family.faces.map(face => face.sourcePath)),
).size)
const activeFace = computed(() => faces.value[activeFaceIndex.value] ?? null)
const generatedKey = computed(() => createAvailableKey(
  fontName.value,
  [...Object.keys(props.registry), ...props.reservedKeys, ...familyDrafts.value
    .filter((_, index) => index !== activeFamilyIndex.value)
    .map(family => family.key || family.name)]
    .filter(key => key.toLocaleLowerCase() !== props.originalKey?.toLocaleLowerCase()),
  'font',
))
const effectiveKey = computed(() => fontKey.value || generatedKey.value)
const validKey = computed(() => projectFontIdPattern.test(effectiveKey.value))
const uniqueKey = computed(() => ![...Object.keys(props.registry), ...props.reservedKeys].some(key => (
  key.toLocaleLowerCase() === effectiveKey.value.toLocaleLowerCase()
  && key.toLocaleLowerCase() !== props.originalKey?.toLocaleLowerCase()
)) && !familyDrafts.value.some((family, index) => index !== activeFamilyIndex.value
  && (family.key || createAvailableKey(family.name, [], 'font')).toLocaleLowerCase()
    === effectiveKey.value.toLocaleLowerCase()))
const styleOptions = computed(() => [
  { value: 'normal', label: t('projectConfig.fonts.styleNormal') },
  { value: 'italic', label: t('projectConfig.fonts.styleItalic') },
  { value: 'oblique', label: t('projectConfig.fonts.styleOblique') },
])
const conflictOptions = computed<readonly OcOption[]>(() => {
  const conflict = activeFace.value?.importConflict
  return [
    {
      value: 'rename-copy',
      label: t('projectConfig.importConflict.renameCopy', {
        name: projectAssetName(conflict?.availableCopySource ?? ''),
      }),
    },
    {
      value: 'use-existing',
      label: t('projectConfig.importConflict.useExisting', {
        name: projectAssetName(conflict?.existingSource ?? ''),
      }),
    },
  ]
})
const selectedConflictPath = computed(() => activeFace.value?.conflictResolution === 'use-existing'
  ? activeFace.value.importConflict?.existingSource ?? ''
  : activeFace.value?.importConflict?.availableCopySource ?? '')
const validFaces = computed(() => faces.value.length > 0 && faces.value.every(face => (
  face.sourcePath
  && face.weight.min >= 1 && face.weight.max <= 1000 && face.weight.min <= face.weight.max
  && face.stretch.min > 0 && face.stretch.max <= 1000 && face.stretch.min <= face.stretch.max
  && (face.style.kind !== 'oblique'
    || (face.style.angle.min >= -90 && face.style.angle.max <= 90
      && face.style.angle.min <= face.style.angle.max))
  && !face.conflictCheckPending
  && !face.conflictCheckFailed
  && (!face.importConflict || face.conflictResolution)
)))
const allFamiliesValid = computed(() => familyDrafts.value.length > 0 && familyDrafts.value.every((family, index) => {
  const key = family.key || generatedFamilyKey(family, index)
  const originalIdentity = family.originalKey?.toLocaleLowerCase()
  return Boolean(family.name.trim())
    && projectFontIdPattern.test(key)
    && ![...Object.keys(props.registry), ...props.reservedKeys].some(candidate => (
      candidate.toLocaleLowerCase() === key.toLocaleLowerCase()
      && candidate.toLocaleLowerCase() !== originalIdentity
    ))
    && family.faces.length > 0
    && family.faces.every(validFace)
    && findOverlappingProjectFontFaces(family.faces).length === 0
}) && new Set(familyDrafts.value.map((family, index) => (
  family.key || generatedFamilyKey(family, index)
).toLocaleLowerCase())).size === familyDrafts.value.length)
const canSubmit = computed(() => Boolean(
  fontName.value.trim() && validKey.value && uniqueKey.value && validFaces.value && allFamiliesValid.value,
))
const dialogTitle = computed(() => editing.value
  ? t('projectConfig.fonts.configure')
  : t('projectConfig.fonts.register'))
const submitLabel = computed(() => editing.value
  ? t('projectConfig.fonts.save')
  : t('projectConfig.fonts.confirmRegister'))
const validationMessage = computed(() => {
  if (metadataError.value) return metadataError.value
  if (!faces.value.length) return t('projectConfig.fonts.faceRequired')
  if (!uniqueKey.value) return t('projectConfig.fonts.keyExists')
  if (fontKey.value && !validKey.value) return t('projectConfig.fonts.invalidKey')
  if (!fontName.value.trim()) return t('projectConfig.fonts.nameRequired')
  if (faces.value.some(face => face.conflictCheckFailed)) return t('projectConfig.importConflict.checkFailed')
  if (!validFaces.value) return t('projectConfig.fonts.invalidFaceDescriptors')
  if (findOverlappingProjectFontFaces(faces.value).length) return t('projectConfig.fonts.overlappingFaces')
  return ''
})

watch([() => props.open, () => props.originalKey], ([open]) => {
  if (!open) return
  const entry = props.originalKey ? props.registry[props.originalKey] : undefined
  const family = entry?.kind === 'family' ? entry.family : undefined
  const initialFaces: FaceDraft[] = (family?.faces ?? []).map(face => ({
    id: nextFaceId++,
    faceName: projectAssetName(face.source),
    originalSource: face.source,
    sourcePath: face.source,
    weight: { ...face.weight },
    stretch: { ...face.stretch },
    style: face.style.kind === 'oblique'
      ? { kind: 'oblique', angle: { ...face.style.angle } }
      : { kind: face.style.kind },
    copyRequired: false,
    importConflict: null,
    conflictCheckPending: false,
    conflictCheckFailed: false,
  }))
  familyDrafts.value = [{
    id: nextFamilyId++,
    ...(family ? { originalKey: family.key } : {}),
    key: family?.key ?? '',
    name: family?.name ?? '',
    faces: initialFaces,
    activeFaceIndex: initialFaces.length ? 0 : -1,
  }]
  activeFamilyIndex.value = 0
  metadataError.value = ''
  advancedOpen.value = editing.value
  if (!editing.value && props.selectFilesOnOpen) void pickInitialFontFiles()
}, { immediate: true })

async function pickInitialFontFiles(): Promise<void> {
  const selected = await pickFontFile(true)
  if (!selected && selectedSourceCount.value === 0) emit('close')
}

async function pickFontFile(append: boolean, replaceAll = false): Promise<boolean> {
  const options = {
    title: t('projectConfig.fonts.pickTitle'),
    fileTypeName: t('projectConfig.fonts.fileType'),
    extensions: ['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'],
    defaultPath: props.defaultOpenPath,
  }
  const paths = append && fileSystemService.pickFiles
    ? await fileSystemService.pickFiles(options)
    : [await fileSystemService.pickFile(options)].filter((path): path is string => Boolean(path))
  if (!paths.length) return false
  if (replaceAll) {
    familyDrafts.value = [{
      id: nextFamilyId++,
      key: '',
      name: '',
      faces: [],
      activeFaceIndex: -1,
    }]
    activeFamilyIndex.value = 0
  }
  metadataError.value = ''
  const affected: Array<{ familyId: number; faceId: number }> = []
  try {
    for (const path of paths) {
      const inspectedFaces = await inspectProjectFontSource(await fileSystemService.readBinaryFile(path))
      if (!inspectedFaces.length) throw new Error('No font faces found')
      let replacedCurrent = false
      for (const inspected of inspectedFaces) {
        const familyName = inspected.familyName || fontNameFromPath(path)
        let family: FamilyDraft | null = activeFamily.value
        if (append && !editing.value) {
          family = familyDrafts.value.find(candidate => (
            candidate.name.toLocaleLowerCase() === familyName.toLocaleLowerCase()
          )) ?? null
          if (!family) {
            const emptyInitial = familyDrafts.value.length === 1
              && !familyDrafts.value[0]?.name && !familyDrafts.value[0]?.faces.length
            family = emptyInitial ? familyDrafts.value[0]! : {
              id: nextFamilyId++,
              key: '',
              name: familyName,
              faces: [],
              activeFaceIndex: -1,
            }
            if (!emptyInitial) familyDrafts.value.push(family)
          }
        }
        if (!family) continue
        if (!family.name.trim()) family.name = familyName
        const draft: FaceDraft = {
          id: nextFaceId++,
          faceName: inspected.faceName,
          sourcePath: path,
          ...(inspected.collectionIndex === undefined ? {} : { collectionIndex: inspected.collectionIndex }),
          weight: { ...inspected.weight },
          stretch: { ...inspected.stretch },
          style: inspected.style.kind === 'oblique'
            ? { kind: 'oblique', angle: { ...inspected.style.angle } }
            : { kind: inspected.style.kind },
          copyRequired: props.getManagedFontSource(path) === null,
          importConflict: null,
          conflictCheckPending: false,
          conflictCheckFailed: false,
        }
        if (!append && !replacedCurrent && family === activeFamily.value && activeFaceIndex.value >= 0) {
          const current = activeFace.value
          family.faces[activeFaceIndex.value] = {
            ...draft,
            weight: current ? { ...current.weight } : draft.weight,
            stretch: current ? { ...current.stretch } : draft.stretch,
            style: current?.style.kind === 'oblique'
              ? { kind: 'oblique', angle: { ...current.style.angle } }
              : current ? { kind: current.style.kind } : draft.style,
          }
          replacedCurrent = true
        } else {
          family.faces.push(draft)
          family.activeFaceIndex = family.faces.length - 1
        }
        affected.push({ familyId: family.id, faceId: draft.id })
      }
    }
  } catch (error) {
    metadataError.value = t('projectConfig.fonts.metadataFailed', {
      message: error instanceof Error ? error.message : String(error),
    })
    return true
  }
  const firstAffectedFamily = familyDrafts.value.findIndex(family => family.id === affected[0]?.familyId)
  if (firstAffectedFamily >= 0) activeFamilyIndex.value = firstAffectedFamily
  await Promise.all(affected.map(item => checkImportConflict(item.familyId, item.faceId)))
  return true
}

function removeFace(index: number): void {
  faces.value = faces.value.filter((_, candidate) => candidate !== index)
  if (!faces.value.length) activeFaceIndex.value = -1
  else if (activeFaceIndex.value >= faces.value.length) activeFaceIndex.value = faces.value.length - 1
  else if (index < activeFaceIndex.value) activeFaceIndex.value -= 1
}

function updateText(field: 'key' | 'name', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  if (field === 'key') fontKey.value = event.target.value
  else fontName.value = event.target.value
}

function updateRange(field: 'weight' | 'stretch', edge: 'min' | 'max', event: Event): void {
  if (!(event.target instanceof HTMLInputElement) || !activeFace.value) return
  const value = Number(event.target.value)
  if (!Number.isFinite(value)) return
  const range = { ...activeFace.value[field], [edge]: value }
  updateActiveFace({ [field]: range })
}

function updateStyleKind(value: string): void {
  if (value === 'normal' || value === 'italic') updateActiveFace({ style: { kind: value } })
  else if (value === 'oblique') updateActiveFace({ style: { kind: 'oblique', angle: { min: 14, max: 14 } } })
}

function updateAngle(edge: 'min' | 'max', event: Event): void {
  if (!(event.target instanceof HTMLInputElement) || activeFace.value?.style.kind !== 'oblique') return
  const value = Number(event.target.value)
  if (!Number.isFinite(value)) return
  updateActiveFace({
    style: {
      kind: 'oblique',
      angle: { ...activeFace.value.style.angle, [edge]: value },
    },
  })
}

function updateActiveFace(patch: Partial<FaceDraft>): void {
  const current = activeFace.value
  if (!current) return
  faces.value[activeFaceIndex.value] = { ...current, ...patch }
}

function close(): void {
  if (!props.busy) emit('close')
}

function submit(): void {
  if (!canSubmit.value) return
  const keys = resolveDraftKeys()
  emit('submit', {
    families: familyDrafts.value.map((family, index) => ({
      ...(family.originalKey ? { originalKey: family.originalKey } : {}),
      key: keys[index]!,
      name: family.name.trim(),
      faces: family.faces.map(face => ({
        ...(face.originalSource ? { originalSource: face.originalSource } : {}),
        sourcePath: face.sourcePath,
        ...(face.collectionIndex === undefined ? {} : { collectionIndex: face.collectionIndex }),
        weight: { ...face.weight },
        stretch: { ...face.stretch },
        style: face.style.kind === 'oblique'
          ? { kind: 'oblique', angle: { ...face.style.angle } }
          : { kind: face.style.kind },
        ...(face.conflictResolution ? { conflictResolution: face.conflictResolution } : {}),
      })),
    })),
  })
}

async function checkImportConflict(familyId: number, faceId: number): Promise<void> {
  const family = familyDrafts.value.find(candidate => candidate.id === familyId)
  const index = family?.faces.findIndex(candidate => candidate.id === faceId) ?? -1
  const face = family?.faces[index]
  if (!face || !face.copyRequired) return
  family!.faces[index] = { ...face, conflictCheckPending: true, conflictCheckFailed: false }
  try {
    const conflict = await props.resolveImportConflict(face.sourcePath, DEFAULT_PROJECT_FONT_DIRECTORY)
    const currentFamily = familyDrafts.value.find(candidate => candidate.id === familyId)
    const currentIndex = currentFamily?.faces.findIndex(candidate => candidate.id === faceId) ?? -1
    if (!currentFamily || currentIndex < 0) return
    currentFamily.faces[currentIndex] = {
      ...currentFamily.faces[currentIndex]!,
      importConflict: conflict,
      conflictResolution: conflict ? 'rename-copy' : undefined,
      conflictCheckPending: false,
    }
  } catch {
    const currentFamily = familyDrafts.value.find(candidate => candidate.id === familyId)
    const currentIndex = currentFamily?.faces.findIndex(candidate => candidate.id === faceId) ?? -1
    if (!currentFamily || currentIndex < 0) return
    currentFamily.faces[currentIndex] = {
      ...currentFamily.faces[currentIndex]!,
      importConflict: null,
      conflictResolution: undefined,
      conflictCheckPending: false,
      conflictCheckFailed: true,
    }
  }
}

function selectConflictResolution(value: string): void {
  if (value !== 'rename-copy' && value !== 'use-existing') return
  updateActiveFace({ conflictResolution: value as ProjectAssetImportResolution })
}

function selectFamily(index: number): void {
  if (!familyDrafts.value[index]) return
  activeFamilyIndex.value = index
}

function validFace(face: FaceDraft): boolean {
  return Boolean(face.sourcePath)
    && face.weight.min >= 1 && face.weight.max <= 1000 && face.weight.min <= face.weight.max
    && face.stretch.min > 0 && face.stretch.max <= 1000 && face.stretch.min <= face.stretch.max
    && (face.style.kind !== 'oblique'
      || (face.style.angle.min >= -90 && face.style.angle.max <= 90
        && face.style.angle.min <= face.style.angle.max))
    && !face.conflictCheckPending
    && !face.conflictCheckFailed
    && (!face.importConflict || Boolean(face.conflictResolution))
}

function generatedFamilyKey(family: FamilyDraft, index: number): string {
  return resolveDraftKeys()[index] ?? createAvailableKey(family.name, [], 'font')
}

function resolveDraftKeys(): string[] {
  const originalKeys = new Set(familyDrafts.value
    .map(family => family.originalKey?.toLocaleLowerCase())
    .filter((key): key is string => Boolean(key)))
  const used = [...Object.keys(props.registry), ...props.reservedKeys]
    .filter(key => !originalKeys.has(key.toLocaleLowerCase()))
  return familyDrafts.value.map(family => {
    const key = family.key || createAvailableKey(family.name, used, 'font')
    used.push(key)
    return key
  })
}

function projectAssetName(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path
}

function fontNameFromPath(path: string): string {
  return projectAssetName(path).replace(/\.(?:woff2?|ttf|otf|ttc|otc)$/i, '')
}
</script>

<style scoped>
.project-font-dialog__mode,
.project-font-dialog__file-control,
.project-font-dialog__faces-header,
.project-font-dialog__face-row {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}
.project-font-dialog__field,
.project-font-dialog__families,
.project-font-dialog__faces,
.project-font-dialog__face-list,
.project-font-dialog__advanced,
.project-font-dialog__summary,
.project-font-dialog__summary-list,
.project-font-dialog__summary-family {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-2);
}
.project-font-dialog__summary-heading,
.project-font-dialog__summary-actions {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}
.project-font-dialog__summary-actions { flex-wrap: wrap; }
.project-font-dialog__summary-family {
  padding-block: var(--oc-space-2);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
}
.project-font-dialog__family-list { display: flex; flex-wrap: wrap; gap: var(--oc-space-1); }
.project-font-dialog__family-list [aria-current="true"] { background: var(--oc-bg-selected); color: var(--oc-fg-accent); }
.project-font-dialog__faces-header,
.project-font-dialog__face-row { justify-content: space-between; }
.project-font-dialog__face-row { padding-block: var(--oc-space-1); border-bottom: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-dialog__face-row > :first-child { min-width: 0; flex: 1; justify-content: flex-start; overflow-wrap: anywhere; }
.project-font-dialog__face-row > :first-child[aria-current="true"] { background: var(--oc-bg-selected); color: var(--oc-fg-accent); }
.project-font-dialog__field { color: var(--oc-fg-muted); font-size: var(--oc-text-sm); }
.project-font-dialog__file-control > :first-child { min-width: 0; flex: 1; }
.project-font-dialog__mode { padding-block: var(--oc-space-2); border-block: var(--oc-border-width) solid var(--oc-border-muted); }
.project-font-dialog__range { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--oc-space-2); }
.project-font-dialog__error { margin: 0; }
.project-font-dialog__conflict { display: grid; gap: var(--oc-space-2); padding: var(--oc-space-3); border-radius: var(--oc-radius-sm); background: var(--oc-bg-warning-subtle); }
.project-font-dialog__conflict p { margin: 0; overflow-wrap: anywhere; }
</style>
