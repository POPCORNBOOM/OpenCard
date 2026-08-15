<template>
  <OcDialog class="project-font-dialog" :open="open" :title="dialogTitle" as="form"
    close-on-backdrop :dismissible="!busy" @request-close="close" @submit="submit">
    <section class="project-font-dialog__summary">
      <template v-if="selectedSourceCount">
        <OcText as="strong">{{ t('projectConfig.fonts.selectedFiles', { count: selectedSourceCount }) }}</OcText>
        <OcText tone="muted" size="sm">{{ activeFamily?.name || t('projectConfig.fonts.unnamedFamily') }}</OcText>
      </template>
      <OcText v-else tone="muted" size="sm">{{ t('projectConfig.fonts.chooseFilesHint') }}</OcText>
      <div class="project-font-dialog__summary-actions">
        <OcButton type="button" icon="nav.files" variant="outline" :disabled="busy" @click="pickFiles(true)">
          {{ selectedSourceCount ? t('projectConfig.fonts.chooseAgain') : t('projectConfig.fonts.chooseFiles') }}
        </OcButton>
        <OcButton v-if="selectedSourceCount" type="button" variant="ghost" icon="tool.settings"
          @click="advancedOpen = !advancedOpen">
          {{ advancedOpen ? t('projectConfig.fonts.simpleSettings') : t('projectConfig.fonts.advancedFace') }}
        </OcButton>
      </div>
    </section>

    <template v-if="advancedOpen">
      <label class="project-font-dialog__field"><span>{{ t('projectConfig.fonts.name') }}</span>
        <OcFieldInput full-width :value="fontName" :aria-invalid="!fontName.trim()" @input="updateText('name', $event)" />
      </label>
      <label class="project-font-dialog__field"><span>{{ t('projectConfig.fonts.key') }}</span>
        <OcFieldInput full-width mono :value="fontKey" :placeholder="generatedKey"
          :aria-invalid="Boolean(fontKey) && (!validKey || !uniqueKey)" @input="updateText('key', $event)" />
      </label>
      <div class="project-font-dialog__slot-grid">
        <div v-for="slot in slotDefinitions" :key="slot.key" class="project-font-dialog__slot">
          <div class="project-font-dialog__slot-heading">
            <span>{{ slot.label }}</span>
          </div>
          <div class="project-font-dialog__slot-control">
            <OcButton class="project-font-dialog__slot-source"
              :class="{ 'project-font-dialog__slot-source--fallback': !activeFamily?.slots[slot.key] && Boolean(fallbackLabel(slot.key)) }"
              type="button" variant="outline" block :disabled="busy" @click="pickSlot(slot.key)">
              {{ activeFamily?.slots[slot.key]
                ? slotSourceLabel(activeFamily.slots[slot.key]!)
                : fallbackLabel(slot.key)
                  || t('projectConfig.fonts.chooseFiles') }}
            </OcButton>
            <OcButton v-if="activeFamily?.slots[slot.key]" type="button" variant="ghost" icon="action.delete"
              icon-only :aria-label="t('projectConfig.fonts.removeFace')" @click="clearSlot(slot.key)" />
          </div>
        </div>
      </div>
      <OcText v-if="metadataError" tone="danger" size="sm" role="alert">{{ metadataError }}</OcText>
      <OcText v-if="validationMessage" tone="danger" size="sm" role="alert">{{ validationMessage }}</OcText>
    </template>
    <OcText v-if="error" tone="danger" size="sm" role="alert">{{ error }}</OcText>

    <template #footer>
      <OcButton type="button" :disabled="busy" @click="close">{{ t('projectConfig.fonts.cancel') }}</OcButton>
      <OcButton type="submit" variant="solid" :disabled="!canSubmit || busy">
        {{ editing ? t('projectConfig.fonts.save') : t('projectConfig.fonts.confirmRegister') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script lang="ts">
export type ProjectFontSlotKey = 'light.upright' | 'light.italic' | 'normal.upright' | 'normal.italic' | 'bold.upright' | 'bold.italic'
export type ProjectFontSlotRequest = {
  originalSource?: string
  sourcePath: string
  collectionIndex?: number
  conflictResolution?: ProjectAssetImportResolution
}
export type ProjectFontFamilyRegistrationRequest = {
  families: Array<{
    originalKey?: string
    key: string
    name: string
    slots: Partial<Record<ProjectFontSlotKey, ProjectFontSlotRequest>>
  }>
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ProjectFontRegistry } from '../../features/workspace/model/projectFontRegistry'
import { projectFontIdPattern, projectFontWeights, projectFontStyles, type ProjectFontWeight, type ProjectFontStyle } from '../../features/workspace/model/projectFontRegistry'
import type { ProjectAssetImportConflict, ProjectAssetImportResolution } from '../../features/workspace/store/projectStore'
import { DEFAULT_PROJECT_FONT_DIRECTORY } from '../../features/workspace/model/projectFonts'
import { createAvailableKey } from '../../shared/model/keySlug'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { inspectProjectFontSource } from '../../features/workspace/services/projectFontMetadata'
import OcButton from '../base/OcButton.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcText from '../base/OcText.vue'
import OcDialog from '../standard/OcDialog.vue'

type SlotDraft = ProjectFontSlotRequest & { faceName: string; copyRequired: boolean; conflict?: ProjectAssetImportConflict | null; pending?: boolean; failed?: boolean }
type FamilyDraft = { originalKey?: string; key: string; name: string; slots: Partial<Record<ProjectFontSlotKey, SlotDraft>> }
const props = withDefaults(defineProps<{
  open: boolean; registry?: ProjectFontRegistry; reservedKeys?: readonly string[]; originalKey?: string
  selectFilesOnOpen?: boolean; defaultOpenPath?: string; busy?: boolean; error?: string
  getManagedFontSource: (path: string) => string | null
  resolveImportConflict: (sourcePath: string, targetDirectory: string) => Promise<ProjectAssetImportConflict | null>
}>(), { registry: () => ({}), reservedKeys: () => [], selectFilesOnOpen: false, busy: false, error: '' })
const emit = defineEmits<{ close: []; submit: [request: ProjectFontFamilyRegistrationRequest] }>()
const { t } = useI18n()
const familyDrafts = ref<FamilyDraft[]>([])
const advancedOpen = ref(false)
const metadataError = ref('')
const activeFamily = computed(() => familyDrafts.value[0] ?? null)
const editing = computed(() => Boolean(props.originalKey))
const fontName = computed(() => activeFamily.value?.name ?? '')
const fontKey = computed(() => activeFamily.value?.key ?? '')
const selectedSourceCount = computed(() => new Set(familyDrafts.value.flatMap(family => Object.values(family.slots).map(slot => slot?.sourcePath))).size)
const slotDefinitions = computed(() => projectFontWeights.flatMap(weight => projectFontStyles.map(style => ({
  key: `${weight}.${style}` as ProjectFontSlotKey,
  label: `${weight === 'light' ? t('projectConfig.fonts.weightLight') : weight === 'normal' ? t('projectConfig.fonts.weightNormal') : t('projectConfig.fonts.weightBold')} · ${style === 'upright' ? t('projectConfig.fonts.styleNormal') : t('projectConfig.fonts.styleItalic')}`,
}))))
const generatedKey = computed(() => createAvailableKey(fontName.value, [...Object.keys(props.registry), ...props.reservedKeys], 'font'))
const effectiveKey = computed(() => fontKey.value || generatedKey.value)
const validKey = computed(() => projectFontIdPattern.test(effectiveKey.value))
const uniqueKey = computed(() => ![...Object.keys(props.registry), ...props.reservedKeys].some(key => key.toLowerCase() === effectiveKey.value.toLowerCase() && key.toLowerCase() !== props.originalKey?.toLowerCase()))
const canSubmit = computed(() => Boolean(activeFamily.value && fontName.value.trim() && validKey.value && uniqueKey.value && selectedSourceCount.value && Object.values(activeFamily.value.slots).every(slot => !slot?.pending && !slot?.failed && (!slot?.conflict || slot.conflictResolution))))
const validationMessage = computed(() => !selectedSourceCount.value ? t('projectConfig.fonts.faceRequired') : !fontName.value.trim() ? t('projectConfig.fonts.nameRequired') : !uniqueKey.value ? t('projectConfig.fonts.keyExists') : '')
const dialogTitle = computed(() => editing.value ? t('projectConfig.fonts.configure') : t('projectConfig.fonts.register'))

watch([() => props.open, () => props.originalKey], ([open]) => {
  if (!open) return
  const entry = props.originalKey ? props.registry[props.originalKey] : undefined
  const font = entry?.kind === 'family' ? entry.family : undefined
  const slots: FamilyDraft['slots'] = {}
  if (font) for (const weight of projectFontWeights) for (const style of projectFontStyles) {
    const source = font.files[weight]?.[style]
    if (source) slots[`${weight}.${style}` as ProjectFontSlotKey] = { sourcePath: source, originalSource: source, faceName: projectAssetName(source), copyRequired: false }
  }
  familyDrafts.value = [{ ...(font?.key ? { originalKey: font.key } : {}), key: font?.key ?? '', name: font?.name ?? '', slots }]
  advancedOpen.value = editing.value
  metadataError.value = ''
  if (!editing.value && props.selectFilesOnOpen) void pickFiles(true).then(selected => {
    if (!selected && selectedSourceCount.value === 0) emit('close')
  })
}, { immediate: true })

async function pickFiles(replaceAll = false): Promise<boolean> {
  const paths = fileSystemService.pickFiles
    ? await fileSystemService.pickFiles({ title: t('projectConfig.fonts.pickTitle'), fileTypeName: t('projectConfig.fonts.fileType'), extensions: ['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'], defaultPath: props.defaultOpenPath })
    : [await fileSystemService.pickFile({ title: t('projectConfig.fonts.pickTitle'), fileTypeName: t('projectConfig.fonts.fileType'), extensions: ['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'], defaultPath: props.defaultOpenPath })].filter((value): value is string => Boolean(value))
  if (!paths.length) return false
  if (replaceAll) familyDrafts.value = [{ key: '', name: '', slots: {} }]
  for (const path of paths) {
    try {
      const inspected = await inspectProjectFontSource(await fileSystemService.readBinaryFile(path))
      for (const face of inspected) {
        const family = activeFamily.value!
        if (!family.name) family.name = face.familyName || fontNameFromPath(path)
        const min = face.weight.min; const max = face.weight.max
        const targets = projectFontWeights.filter(weight => {
          const value = weight === 'light' ? 300 : weight === 'normal' ? 400 : 700
          return min <= value && value <= max
        })
        const weights = targets.length ? targets : [min < 375 ? 'light' : min > 550 ? 'bold' : 'normal'] as const
        const style = face.style.kind === 'italic' || face.style.kind === 'oblique' ? 'italic' : 'upright'
        for (const weight of weights) {
          const key = `${weight}.${style}` as ProjectFontSlotKey
          if (family.slots[key]) continue
          const slot: SlotDraft = { sourcePath: path, ...(face.collectionIndex === undefined ? {} : { collectionIndex: face.collectionIndex }), faceName: face.faceName || projectAssetName(path), copyRequired: props.getManagedFontSource(path) === null }
          family.slots[key] = slot
          await checkConflict(key, slot)
        }
      }
    } catch (error) {
      metadataError.value = error instanceof Error ? error.message : String(error)
    }
  }
  return true
}
async function pickSlot(key: ProjectFontSlotKey): Promise<void> {
  const path = await fileSystemService.pickFile({
    title: t('projectConfig.fonts.pickTitle'), fileTypeName: t('projectConfig.fonts.fileType'),
    extensions: ['woff', 'woff2', 'ttf', 'otf', 'ttc', 'otc'], defaultPath: props.defaultOpenPath,
  })
  if (!path || !activeFamily.value) return
  try {
    const inspected = await inspectProjectFontSource(await fileSystemService.readBinaryFile(path))
    const [weight, style] = key.split('.') as [ProjectFontWeight, ProjectFontStyle]
    const target = weightValue(weight)
    const preferred = [...inspected].sort((left, right) => {
      const leftStyle = left.style.kind === 'normal' ? 'upright' : 'italic'
      const rightStyle = right.style.kind === 'normal' ? 'upright' : 'italic'
      return Number(leftStyle !== style) - Number(rightStyle !== style)
        || Math.abs((left.weight.min + left.weight.max) / 2 - target) - Math.abs((right.weight.min + right.weight.max) / 2 - target)
    })[0]
    if (!preferred) throw new Error('No font entries found')
    const slot: SlotDraft = {
      sourcePath: path,
      ...(preferred.collectionIndex === undefined ? {} : { collectionIndex: preferred.collectionIndex }),
      faceName: preferred.faceName || projectAssetName(path),
      copyRequired: props.getManagedFontSource(path) === null,
    }
    activeFamily.value.slots[key] = slot
    await checkConflict(key, slot)
  } catch (error) {
    metadataError.value = error instanceof Error ? error.message : String(error)
  }
}
function clearSlot(key: ProjectFontSlotKey): void { if (activeFamily.value) delete activeFamily.value.slots[key] }
function slotSourceLabel(slot: SlotDraft): string {
  const fileName = projectAssetName(slot.sourcePath)
  const faceName = slot.faceName.trim()
  return faceName && faceName.toLowerCase() !== 'regular' && faceName.toLowerCase() !== fileName.toLowerCase()
    ? `${fileName} · ${faceName}`
    : fileName
}
function fallbackLabel(key: ProjectFontSlotKey): string {
  const [weight, style] = key.split('.') as [ProjectFontWeight, ProjectFontStyle]
  for (const posture of [style, style === 'italic' ? 'upright' : 'italic'] as const) {
    const candidates = projectFontWeights.flatMap(candidate => {
      const slot = activeFamily.value?.slots[`${candidate}.${posture}` as ProjectFontSlotKey]
      return slot ? [{ source: slotSourceLabel(slot), distance: Math.abs(weightValue(candidate) - weightValue(weight)) }] : []
    }).sort((a, b) => a.distance - b.distance)
    if (candidates[0]) return candidates[0].source
  }
  return ''
}
async function checkConflict(_key: ProjectFontSlotKey, slot: SlotDraft): Promise<void> {
  if (!slot.copyRequired) return
  slot.pending = true
  try { slot.conflict = await props.resolveImportConflict(slot.sourcePath, DEFAULT_PROJECT_FONT_DIRECTORY); slot.conflictResolution = slot.conflict ? 'rename-copy' : undefined }
  catch { slot.failed = true }
  finally { slot.pending = false }
}
function updateText(field: 'key' | 'name', event: Event): void {
  if (!(event.target instanceof HTMLInputElement) || !activeFamily.value) return
  if (field === 'key') activeFamily.value.key = event.target.value
  else activeFamily.value.name = event.target.value
}
function submit(): void {
  if (!canSubmit.value || !activeFamily.value) return
  const slots = Object.fromEntries(Object.entries(activeFamily.value.slots).map(([key, slot]) => [key, {
    originalSource: slot!.originalSource, sourcePath: slot!.sourcePath, ...(slot!.collectionIndex === undefined ? {} : { collectionIndex: slot!.collectionIndex }), ...(slot!.conflictResolution ? { conflictResolution: slot!.conflictResolution } : {}),
  }])) as Partial<Record<ProjectFontSlotKey, ProjectFontSlotRequest>>
  emit('submit', { families: [{ ...(activeFamily.value.originalKey ? { originalKey: activeFamily.value.originalKey } : {}), key: effectiveKey.value, name: activeFamily.value.name.trim(), slots }] })
}
function close(): void { if (!props.busy) emit('close') }
function weightValue(weight: ProjectFontWeight): number { return weight === 'light' ? 300 : weight === 'normal' ? 400 : 700 }
function projectAssetName(path: string): string { return path.replace(/\\/g, '/').split('/').pop() ?? path }
function fontNameFromPath(path: string): string { return projectAssetName(path).replace(/\.(?:woff2?|ttf|otf|ttc|otc)$/i, '') }
</script>

<style scoped>
.project-font-dialog__summary-actions { display: flex; gap: var(--oc-space-2); margin-top: var(--oc-space-3); }
.project-font-dialog__field { display: grid; gap: var(--oc-space-1); margin-top: var(--oc-space-3); }
.project-font-dialog__slot-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--oc-space-2); margin-top: var(--oc-space-4); }
.project-font-dialog__slot { min-width: 0; }
.project-font-dialog__slot-heading { color: var(--oc-fg-muted); font-size: var(--oc-text-sm); margin-bottom: var(--oc-space-1); }
.project-font-dialog__slot-control { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: var(--oc-space-1); min-width: 0; }
.project-font-dialog__slot-source { width: 100%; min-width: 0; overflow: hidden; }
.project-font-dialog__slot-source--fallback { color: var(--oc-fg-muted); }
:deep(.project-font-dialog__slot-source .oc-button__content) { width: 100%; justify-content: flex-start; overflow: hidden; }
:deep(.project-font-dialog__slot-source .oc-button__label) { display: block; width: 100%; text-align: left; }
</style>
