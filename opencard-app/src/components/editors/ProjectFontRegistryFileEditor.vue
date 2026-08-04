<template>
  <ProjectRegistryEditorShell icon="file.font" content-mode="workspace" header-mode="hidden"
    :heading="t('fontRegistry.title')" :description="t('fontRegistry.description')"
    @keydown.ctrl.s.prevent="save">
    <ProjectFontRegistryEditor v-if="document" ref="workbenchRef" :heading="t('fontRegistry.title')"
      :description="t('fontRegistry.description')" :fonts="document.fonts ?? []" :font-sets="document.fontSets ?? []"
      :resolve-asset-src="projectStore.resolveAssetSrc" :load-errors="projectStore.projectFontLoadErrors.value"
      :error="importError" @update:fonts="updateFonts" @update:font-sets="updateFontSets"
      @register-font="openRegistrationDialog()" @configure-font="openRegistrationDialog"
      @register-font-set="openFontSetDialog()" @configure-font-set="openFontSetDialog" />

    <ProjectRegistryRepairEditor v-else :model-value="props.modelValue ?? ''" :theme-id="themeId"
      :theme-overrides="themeOverrides" :heading="t('fontRegistry.invalid')" :description="t('fontRegistry.repair')"
      @update:model-value="updateRawSource" @save="save" />

    <ProjectFontRegistrationDialog :open="registrationDialogOpen" :fonts="flatFonts"
      :reserved-keys="(document?.fontSets ?? []).map(fontSet => fontSet.key)"
      :original-key="registrationOriginalKey" :busy="importBusy" :error="importError"
      :default-directory="settingsStore.settings.value.workspace.defaultFontImportDirectory"
      :default-open-path="projectDirectory" :get-relative-project-path="projectStore.getRelativeProjectPathIfInside"
      :resolve-import-conflict="projectStore.getProjectFontImportConflict"
      @close="closeRegistrationDialog" @submit="registerFont" />
    <ProjectFontSetDialog :open="fontSetDialogOpen" :fonts="document?.fonts ?? []"
      :font-sets="document?.fontSets ?? []" :original-key="fontSetOriginalKey"
      @close="closeFontSetDialog" @submit="saveFontSet" />
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { EditorIssue, EditorIssueSnapshot, EditorNavigationResult, SessionNavigationToken } from '../../features/editor-runtime/model/editorIssue'
import { reportAppError } from '../../features/logging/appErrorCatalog'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'
import {
  flattenProjectFonts,
  parseProjectFontRegistryText,
  PROJECT_FONT_REGISTRY_FILE_NAME,
  serializeProjectFontRegistry,
  type ProjectFont,
  type ProjectFontSet,
  type ProjectFontRegistryDocument,
} from '../../features/workspace/model/projectFontRegistry'
import { findProjectFontRegistryIssues } from '../../features/workspace/model/projectFonts'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import ProjectFontRegistrationDialog, {
  type ProjectFontRegistrationRequest,
} from './ProjectFontRegistrationDialog.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import ProjectFontSetDialog, { type ProjectFontSetRequest } from './ProjectFontSetDialog.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import ProjectRegistryRepairEditor from './ProjectRegistryRepairEditor.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const settingsStore = useAppSettingsStore()
const document = ref<ProjectFontRegistryDocument | null>(null)
const importBusy = ref(false)
const importError = ref('')
const registrationDialogOpen = ref(false)
const registrationOriginalKey = ref<string>()
const fontSetDialogOpen = ref(false)
const fontSetOriginalKey = ref<string>()
const workbenchRef = ref<InstanceType<typeof ProjectFontRegistryEditor> | null>(null)

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const flatFonts = computed(() => flattenProjectFonts(document.value?.fonts))
const projectDirectory = computed(() => {
  const source = projectStore.projectPath.value || props.filePath
  const normalized = source.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.endsWith(`/${PROJECT_FONT_REGISTRY_FILE_NAME}`)
    ? normalized.slice(0, -PROJECT_FONT_REGISTRY_FILE_NAME.length - 1)
    : normalized
})
const issueSnapshot = computed<EditorIssueSnapshot>(() => {
  const fontSets = document.value?.fontSets ?? []
  const registryIssues: EditorIssue[] = document.value
    ? findProjectFontRegistryIssues({ fonts: document.value.fonts ?? [], fontSets }).map((issue, index) => ({
        id: `project-font-registry:${issue.kind}:${issue.fontSetKey}:${index}`,
        type: `project-font-registry.${issue.kind}`,
        severity: issue.kind === 'empty-set' ? 'warning' : 'error',
        locationText: t('projectConfig.fonts.fontSetIssueLocation', { set: issue.fontSetKey }),
        description: issue.kind === 'empty-set'
          ? t('projectConfig.fonts.emptySetIssue')
          : issue.kind === 'missing'
            ? t('projectConfig.fonts.missingReferenceIssue', { key: issue.key })
            : t('projectConfig.fonts.cycleIssue', { path: issue.path.join(' -> ') }),
        navigationToken: { protocol: 'font-registry', version: 1, target: { kind: 'font-set', key: issue.fontSetKey } },
      }))
    : []
  const loadIssues: EditorIssue[] = projectStore.projectFontLoadErrors.value.map((error, index) => ({
    id: `project-font-load:${error.fontId}:${index}`,
    type: 'project-font-registry.load-failed',
    severity: 'error',
    locationText: t('projectConfig.fonts.fontIssueLocation', { font: error.fontId }),
    description: t('projectConfig.fonts.loadFailed', { message: error.message }),
    navigationToken: { protocol: 'font-registry', version: 1, target: { kind: 'font', key: error.fontId } },
  }))
  return { scopeKey: 'project-font-registry', scopeOrder: ['project-font-registry'], issues: [...registryIssues, ...loadIssues] }
})

watch(() => props.modelValue, content => {
  document.value = parseProjectFontRegistryText(content ?? '')
}, { immediate: true })
watch(issueSnapshot, snapshot => emit('issue-snapshot', snapshot), { immediate: true })

function commit(next: ProjectFontRegistryDocument): void {
  try {
    const content = serializeProjectFontRegistry(next)
    document.value = parseProjectFontRegistryText(content)
    emit('update:modelValue', content)
  } catch (error) {
    reportAppError('OC-E3012', error)
  }
}

function updateFonts(fonts: readonly ProjectFont[]): void {
  commit({ ...(fonts.length ? { fonts } : {}), ...(document.value?.fontSets?.length ? { fontSets: document.value.fontSets } : {}) })
}

function updateFontSets(fontSets: readonly ProjectFontSet[]): void {
  commit({ ...(document.value?.fonts?.length ? { fonts: document.value.fonts } : {}), ...(fontSets.length ? { fontSets } : {}) })
}

function openRegistrationDialog(originalKey?: string): void {
  if (!document.value || importBusy.value) return
  if (originalKey && !document.value.fonts?.some(font => font.key === originalKey)) return
  importError.value = ''
  registrationOriginalKey.value = originalKey
  registrationDialogOpen.value = true
}

function closeRegistrationDialog(): void {
  if (importBusy.value) return
  registrationDialogOpen.value = false
  registrationOriginalKey.value = undefined
  importError.value = ''
}

function openFontSetDialog(originalKey?: string): void {
  if (!document.value) return
  if (originalKey && !document.value.fontSets?.some(fontSet => fontSet.key === originalKey)) return
  fontSetOriginalKey.value = originalKey
  fontSetDialogOpen.value = true
}

function closeFontSetDialog(): void {
  fontSetDialogOpen.value = false
  fontSetOriginalKey.value = undefined
}

async function registerFont(request: ProjectFontRegistrationRequest): Promise<void> {
  if (!document.value || importBusy.value) return
  importError.value = ''
  importBusy.value = true
  try {
    const originalIdentity = request.originalKey?.toLocaleLowerCase()
    const fonts = document.value.fonts ?? []
    const fontSets = document.value.fontSets ?? []
    if ([...fonts, ...fontSets].some(entry => (
      entry.key.toLocaleLowerCase() === request.key.toLocaleLowerCase()
      && entry.key.toLocaleLowerCase() !== originalIdentity
    ))) {
      importError.value = t('projectConfig.fonts.keyExists')
      return
    }
    const original = request.originalKey
      ? fonts.find(font => font.key === request.originalKey)
      : undefined
    const source = original && request.sourcePath === original.source && !request.targetDirectory
      ? original.source
      : (await projectStore.importProjectFontFile(
          request.sourcePath,
          request.targetDirectory,
          request.conflictResolution,
        )).source
    const font = { key: request.key, name: request.name, source }
    const nextFonts = request.originalKey
      ? fonts.map(candidate => candidate.key === request.originalKey ? font : candidate)
      : [...fonts, font]
    const nextFontSets = request.originalKey && request.originalKey !== request.key
      ? fontSets.map(fontSet => ({ ...fontSet, fontKeys: fontSet.fontKeys.map(key => key === request.originalKey ? request.key : key) }))
      : fontSets
    commit({ fonts: nextFonts, ...(nextFontSets.length ? { fontSets: nextFontSets } : {}) })
    registrationDialogOpen.value = false
    registrationOriginalKey.value = undefined
  } catch (error) {
    reportAppError('OC-E3007', error)
    importError.value = t('projectConfig.fonts.registrationFailed')
  } finally {
    importBusy.value = false
  }
}

function saveFontSet(request: ProjectFontSetRequest): void {
  if (!document.value) return
  const fonts = document.value.fonts ?? []
  const fontSets = document.value.fontSets ?? []
  const originalIdentity = request.originalKey?.toLocaleLowerCase()
  if ([...fonts, ...fontSets].some(entry => (
    entry.key.toLocaleLowerCase() === request.key.toLocaleLowerCase()
    && entry.key.toLocaleLowerCase() !== originalIdentity
  ))) return
  const nextEntry = { key: request.key, name: request.name, fontKeys: request.fontKeys }
  let nextFontSets = request.originalKey
    ? fontSets.map(fontSet => fontSet.key === request.originalKey ? nextEntry : fontSet)
    : [...fontSets, nextEntry]
  if (request.originalKey && request.originalKey !== request.key) {
    nextFontSets = nextFontSets.map(fontSet => ({
      ...fontSet,
      fontKeys: fontSet.fontKeys.map(key => key === request.originalKey ? request.key : key),
    }))
  }
  commit({ ...(fonts.length ? { fonts } : {}), fontSets: nextFontSets })
  fontSetDialogOpen.value = false
  fontSetOriginalKey.value = undefined
}

function updateRawSource(content: string): void {
  emit('update:modelValue', content)
}

function save(): void {
  if (document.value) emit('save')
}

function isNavigationToken(token: SessionNavigationToken): token is {
  protocol: 'font-registry'; version: 1; target: { kind: 'font' | 'font-set'; key: string }
} {
  if (!token || typeof token !== 'object' || Array.isArray(token)) return false
  const candidate = token as Record<string, unknown>
  const target = candidate.target
  if (candidate.protocol !== 'font-registry' || candidate.version !== 1 || !target || typeof target !== 'object' || Array.isArray(target)) return false
  const value = target as Record<string, unknown>
  return (value.kind === 'font' || value.kind === 'font-set') && typeof value.key === 'string'
}

async function navigate(token: SessionNavigationToken): Promise<EditorNavigationResult> {
  if (!isNavigationToken(token)) return 'invalid-token'
  await nextTick()
  return await workbenchRef.value?.navigateToFont(token.target.kind, token.target.key) ? 'success' : 'not-found'
}

defineExpose({ save, navigate })
</script>
