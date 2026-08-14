<template>
  <ProjectRegistryEditorShell icon="file.font" content-mode="workspace" header-mode="hidden"
    :heading="t('fontRegistry.title')" :description="t('fontRegistry.description')"
    @keydown.ctrl.s.prevent="save">
    <ProjectFontRegistryEditor v-if="document" ref="workbenchRef" :heading="t('fontRegistry.title')"
      :description="t('fontRegistry.description')" :families="document.families ?? []"
      :compositions="document.compositions ?? []"
      :resolve-asset-src="source => projectStore.resolveAssetSrc(projectStore.resolveProjectInternalPath(source))"
      :read-font-bytes="readFontBytes"
      :load-errors="projectStore.projectFontLoadErrors.value"
      :error="importError" @update:families="updateFamilies" @update:compositions="updateCompositions"
      @register-family="openRegistrationDialog()" @configure-family="openRegistrationDialog"
      @register-composition="openCompositionDialog()" @configure-composition="openCompositionDialog" />

    <ProjectRegistryRepairEditor v-else :model-value="props.modelValue ?? ''" :theme-id="themeId"
      :theme-overrides="themeOverrides" :heading="t('fontRegistry.invalid')" :description="t('fontRegistry.repair')"
      @update:model-value="updateRawSource" @save="save" />

    <ProjectFontRegistrationDialog :open="registrationDialogOpen" :registry="fontRegistry"
      :reserved-keys="(document?.compositions ?? []).map(composition => composition.key)"
      :original-key="registrationOriginalKey" :busy="importBusy" :error="importError"
      :default-open-path="projectDirectory" :get-relative-project-path="projectStore.getRelativeProjectPathIfInside"
      :resolve-import-conflict="projectStore.getProjectFontImportConflict"
      @close="closeRegistrationDialog" @submit="registerFont" />
    <ProjectFontCompositionDialog :open="compositionDialogOpen" :families="document?.families ?? []"
      :compositions="document?.compositions ?? []" :original-key="compositionOriginalKey"
      @close="closeCompositionDialog" @submit="saveComposition" />
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type { HistoryOperationMeta } from '../../features/editor-runtime/history/structuredHistory'
import type { EditorIssue, EditorIssueSnapshot, EditorNavigationResult, SessionNavigationToken } from '../../features/editor-runtime/model/editorIssue'
import { reportAppError } from '../../features/logging/appErrorCatalog'
import {
  buildProjectFontRegistry,
  parseProjectFontRegistryText,
  PROJECT_FONT_REGISTRY_FILE_NAME,
  serializeProjectFontRegistry,
  type ProjectFontComposition,
  type ProjectFontFamily,
  type ProjectFontRegistryDocument,
} from '../../features/workspace/model/projectFontRegistry'
import { findProjectFontRegistryIssues } from '../../features/workspace/model/projectFonts'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import ProjectFontRegistrationDialog, {
  type ProjectFontFamilyRegistrationRequest,
} from './ProjectFontRegistrationDialog.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import ProjectFontCompositionDialog, {
  type ProjectFontCompositionRequest,
} from './ProjectFontCompositionDialog.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import ProjectRegistryRepairEditor from './ProjectRegistryRepairEditor.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const document = ref<ProjectFontRegistryDocument | null>(null)
const importBusy = ref(false)
const importError = ref('')
const registrationDialogOpen = ref(false)
const registrationOriginalKey = ref<string>()
const compositionDialogOpen = ref(false)
const compositionOriginalKey = ref<string>()
const workbenchRef = ref<InstanceType<typeof ProjectFontRegistryEditor> | null>(null)

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const fontRegistry = computed(() => buildProjectFontRegistry(document.value ?? {}))
const projectDirectory = computed(() => {
  const source = projectStore.projectPath.value || props.filePath
  const normalized = source.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.endsWith(`/${PROJECT_FONT_REGISTRY_FILE_NAME}`)
    ? normalized.slice(0, -PROJECT_FONT_REGISTRY_FILE_NAME.length - 1)
    : normalized
})
const readFontBytes = (source: string) => fileSystemService.readBinaryFile(projectStore.resolveProjectInternalPath(source))
const issueSnapshot = computed<EditorIssueSnapshot>(() => {
  const families = document.value?.families ?? []
  const compositions = document.value?.compositions ?? []
  const registryIssues: EditorIssue[] = document.value
    ? findProjectFontRegistryIssues({ families, compositions }).map((issue, index) => ({
        id: `project-font-registry:${issue.kind}:${index}`,
        type: `project-font-registry.${issue.kind}`,
        severity: issue.kind === 'empty-family' || issue.kind === 'empty-composition' ? 'warning' : 'error',
        locationText: issue.kind === 'empty-family'
          ? t('projectConfig.fonts.fontIssueLocation', { font: issue.familyKey })
          : t('projectConfig.fonts.fontSetIssueLocation', { set: issue.compositionKey }),
        description: issue.kind === 'empty-family'
          ? t('projectConfig.fonts.emptyFamilyIssue')
          : issue.kind === 'empty-composition'
          ? t('projectConfig.fonts.emptySetIssue')
          : t('projectConfig.fonts.missingReferenceIssue', { key: issue.familyKey }),
        navigationToken: {
          protocol: 'font-registry',
          version: 1,
          target: issue.kind === 'empty-family'
            ? { kind: 'family', key: issue.familyKey }
            : { kind: 'composition', key: issue.compositionKey },
        },
      }))
    : []
  const loadIssues: EditorIssue[] = projectStore.projectFontLoadErrors.value.map((error, index) => ({
    id: `project-font-load:${error.familyKey}:${index}`,
    type: 'project-font-registry.load-failed',
    severity: 'error',
    locationText: t('projectConfig.fonts.fontIssueLocation', { font: error.familyKey }),
    description: t('projectConfig.fonts.loadFailed', { message: error.message }),
    navigationToken: { protocol: 'font-registry', version: 1, target: { kind: 'family', key: error.familyKey } },
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

function updateFamilies(families: readonly ProjectFontFamily[]): void {
  commit({ ...(families.length ? { families } : {}), ...(document.value?.compositions?.length ? { compositions: document.value.compositions } : {}) })
}

function updateCompositions(compositions: readonly ProjectFontComposition[]): void {
  commit({ ...(document.value?.families?.length ? { families: document.value.families } : {}), ...(compositions.length ? { compositions } : {}) })
}

function openRegistrationDialog(originalKey?: string): void {
  if (!document.value || importBusy.value) return
  if (originalKey && !document.value.families?.some(family => family.key === originalKey)) return
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

function openCompositionDialog(originalKey?: string): void {
  if (!document.value) return
  if (originalKey && !document.value.compositions?.some(composition => composition.key === originalKey)) return
  compositionOriginalKey.value = originalKey
  compositionDialogOpen.value = true
}

function closeCompositionDialog(): void {
  compositionDialogOpen.value = false
  compositionOriginalKey.value = undefined
}

async function registerFont(request: ProjectFontFamilyRegistrationRequest): Promise<void> {
  if (!document.value || importBusy.value) return
  importError.value = ''
  importBusy.value = true
  try {
    const originalIdentity = request.originalKey?.toLocaleLowerCase()
    const families = document.value.families ?? []
    const compositions = document.value.compositions ?? []
    if ([...families, ...compositions].some(entry => (
      entry.key.toLocaleLowerCase() === request.key.toLocaleLowerCase()
      && entry.key.toLocaleLowerCase() !== originalIdentity
    ))) {
      importError.value = t('projectConfig.fonts.keyExists')
      return
    }
    const original = request.originalKey
      ? families.find(family => family.key === request.originalKey)
      : undefined
    const originalFace = original?.faces[0]
    const sources = originalFace && request.sourcePath === originalFace.source
      ? [originalFace.source]
      : (await projectStore.importProjectFontFiles(
          request.sourcePath,
          request.conflictResolution,
        )).sources
    const importedFaces = sources.map(source => ({
      source,
      weight: request.weight,
      stretch: request.stretch,
      style: request.style,
    }))
    const family = {
      key: request.key,
      name: request.name,
      faces: original ? [...importedFaces, ...original.faces.slice(1)] : importedFaces,
    }
    const nextFamilies = request.originalKey
      ? families.map(candidate => candidate.key === request.originalKey ? family : candidate)
      : [...families, family]
    const nextCompositions = request.originalKey && request.originalKey !== request.key
      ? compositions.map(composition => ({
          ...composition,
          members: composition.members.map(member => member.familyKey === request.originalKey
            ? { ...member, familyKey: request.key }
            : member),
        }))
      : compositions
    commit({ families: nextFamilies, ...(nextCompositions.length ? { compositions: nextCompositions } : {}) })
    registrationDialogOpen.value = false
    registrationOriginalKey.value = undefined
  } catch (error) {
    reportAppError('OC-E3007', error)
    importError.value = error instanceof Error
      ? t('projectConfig.fonts.registrationFailedWithReason', { message: error.message })
      : t('projectConfig.fonts.registrationFailed')
  } finally {
    importBusy.value = false
  }
}

function saveComposition(request: ProjectFontCompositionRequest): void {
  if (!document.value) return
  const families = document.value.families ?? []
  const compositions = document.value.compositions ?? []
  const originalIdentity = request.originalKey?.toLocaleLowerCase()
  if ([...families, ...compositions].some(entry => (
    entry.key.toLocaleLowerCase() === request.key.toLocaleLowerCase()
    && entry.key.toLocaleLowerCase() !== originalIdentity
  ))) return
  const nextEntry = { key: request.key, name: request.name, members: request.members }
  const nextCompositions = request.originalKey
    ? compositions.map(composition => composition.key === request.originalKey ? nextEntry : composition)
    : [...compositions, nextEntry]
  commit({ ...(families.length ? { families } : {}), compositions: nextCompositions })
  compositionDialogOpen.value = false
  compositionOriginalKey.value = undefined
}

function updateRawSource(content: string, history?: HistoryOperationMeta): void {
  emit('update:modelValue', content, history)
}

function save(): void {
  if (document.value) emit('save')
}

function isNavigationToken(token: SessionNavigationToken): token is {
  protocol: 'font-registry'; version: 1; target: { kind: 'family' | 'composition'; key: string }
} {
  if (!token || typeof token !== 'object' || Array.isArray(token)) return false
  const candidate = token as Record<string, unknown>
  const target = candidate.target
  if (candidate.protocol !== 'font-registry' || candidate.version !== 1 || !target || typeof target !== 'object' || Array.isArray(target)) return false
  const value = target as Record<string, unknown>
  return (value.kind === 'family' || value.kind === 'composition') && typeof value.key === 'string'
}

async function navigate(token: SessionNavigationToken): Promise<EditorNavigationResult> {
  if (!isNavigationToken(token)) return 'invalid-token'
  await nextTick()
  return await workbenchRef.value?.navigateToFont(token.target.kind, token.target.key) ? 'success' : 'not-found'
}

defineExpose({ save, navigate })
</script>
