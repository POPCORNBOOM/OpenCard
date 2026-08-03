<template>
  <ProjectRegistryEditorShell icon="file.package-variant" content-mode="workspace" header-mode="hidden"
    :heading="t('iconRegistry.title')"
    :description="t('iconRegistry.description')" @keydown.ctrl.s.prevent="save">
    <ProjectIconRegistryWorkbench v-if="document" ref="workbenchRef" :heading="t('iconRegistry.title')"
      :description="t('iconRegistry.description')" :series="document.iconSeries"
      :resolve-asset-src="projectStore.resolveAssetSrc" :project-icon-catalog="projectStore.projectIconCatalog.value"
      :error="importError"
      @update:series="updateIconSeries" @key-conflicts="updateKeyConflicts" @register="openRegistrationDialog" />

    <ProjectRegistryRepairEditor v-else :model-value="props.modelValue ?? ''" :theme-id="themeId"
      :theme-overrides="themeOverrides" :heading="t('iconRegistry.invalid')" :description="t('iconRegistry.repair')"
      @update:model-value="updateRawSource" @save="save" />

    <ProjectIconRegistrationDialog :open="registrationDialogOpen" :series="document?.iconSeries"
      :busy="importBusy" :error="importError"
      :default-directory="settingsStore.settings.value.workspace.defaultIconImportDirectory"
      :default-open-path="projectDirectory" :get-relative-project-path="projectStore.getRelativeProjectPathIfInside"
      :resolve-import-conflict="projectStore.getProjectIconImportConflict"
      @close="closeRegistrationDialog" @submit="registerIconSet" />
  </ProjectRegistryEditorShell>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EditorEmits, EditorProps } from '../../features/editor-runtime/registry/editorRegistry'
import type {
  EditorIssue,
  EditorIssueSnapshot,
  EditorNavigationResult,
  SessionNavigationToken,
} from '../../features/editor-runtime/model/editorIssue'
import { reportAppError } from '../../features/logging/appErrorCatalog'
import { useAppSettingsStore } from '../../features/settings/store/appSettingsStore'
import {
  parseProjectIconRegistryText,
  PROJECT_ICON_REGISTRY_FILE_NAME,
  serializeProjectIconRegistry,
  type ProjectIconRegistryDocument,
} from '../../features/workspace/model/projectIconRegistry'
import {
  DEFAULT_PROJECT_ICON_GRID_SETTINGS,
  type ProjectIconKeyConflict,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import ProjectIconRegistrationDialog, {
  type ProjectIconRegistrationRequest,
} from './ProjectIconRegistrationDialog.vue'
import ProjectIconRegistryWorkbench from './ProjectIconRegistryWorkbench.vue'
import ProjectRegistryEditorShell from './ProjectRegistryEditorShell.vue'
import ProjectRegistryRepairEditor from './ProjectRegistryRepairEditor.vue'

const props = defineProps<EditorProps>()
const emit = defineEmits<EditorEmits>()
const { t } = useI18n()
const projectStore = useProjectStore()
const settingsStore = useAppSettingsStore()
const document = ref<ProjectIconRegistryDocument | null>(null)
const importBusy = ref(false)
const importError = ref('')
const registrationDialogOpen = ref(false)
const keyConflicts = ref<readonly ProjectIconKeyConflict[]>([])
const workbenchRef = ref<InstanceType<typeof ProjectIconRegistryWorkbench> | null>(null)

const themeId = computed(() => props.themeId ?? 'dark')
const themeOverrides = computed(() => props.themeOverrides ?? {})
const projectDirectory = computed(() => {
  const source = projectStore.projectPath.value || props.filePath
  const normalized = source.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.endsWith(`/${PROJECT_ICON_REGISTRY_FILE_NAME}`)
    ? normalized.slice(0, -PROJECT_ICON_REGISTRY_FILE_NAME.length - 1)
    : normalized
})
const issueSnapshot = computed<EditorIssueSnapshot>(() => ({
  scopeKey: 'project-icon-registry',
  scopeOrder: ['project-icon-registry'],
  issues: keyConflicts.value.map((conflict): EditorIssue => {
    const series = document.value?.iconSeries?.[conflict.seriesIndex]
    const icon = conflict.kind === 'icon' ? series?.icons[conflict.iconIndex] : undefined
    return {
      id: `project-icon-key:${conflict.kind}:${conflict.seriesIndex}:${conflict.kind === 'icon' ? conflict.iconIndex : 'series'}`,
      type: conflict.kind === 'series'
        ? 'project-icon-registry.series.duplicate-key'
        : 'project-icon-registry.icon.duplicate-key',
      severity: 'error',
      locationText: conflict.kind === 'series'
        ? t('projectConfig.icons.seriesKeyLocation', { series: series?.name ?? conflict.key })
        : t('projectConfig.icons.iconKeyLocation', {
            series: series?.name ?? '',
            icon: icon?.name || icon?.iconKey || conflict.iconIndex + 1,
          }),
      description: t(conflict.kind === 'series'
        ? 'projectConfig.icons.duplicateSeriesKeyIssue'
        : 'projectConfig.icons.duplicateIconKeyIssue', { key: conflict.key }),
      navigationToken: {
        protocol: 'icon-registry',
        version: 1,
        target: conflict.kind === 'series'
          ? { kind: 'series-key', seriesIndex: conflict.seriesIndex, key: conflict.key }
          : {
              kind: 'icon-key',
              seriesIndex: conflict.seriesIndex,
              iconIndex: conflict.iconIndex,
              key: conflict.key,
            },
      },
    }
  }),
}))

watch(() => props.modelValue, content => {
  document.value = parseProjectIconRegistryText(content ?? '')
  if (!document.value) keyConflicts.value = []
}, { immediate: true })
watch(issueSnapshot, snapshot => emit('issue-snapshot', snapshot), { immediate: true })

function commit(next: ProjectIconRegistryDocument): void {
  try {
    const content = serializeProjectIconRegistry(next)
    document.value = parseProjectIconRegistryText(content)
    emit('update:modelValue', content)
  } catch (error) {
    reportAppError('OC-E3012', error)
  }
}

function updateIconSeries(iconSeries: ProjectIconSeries[]): void {
  commit(iconSeries.length > 0 ? { iconSeries } : {})
}

function updateKeyConflicts(conflicts: readonly ProjectIconKeyConflict[]): void {
  keyConflicts.value = conflicts
}

function openRegistrationDialog(): void {
  if (!document.value || importBusy.value) return
  importError.value = ''
  registrationDialogOpen.value = true
}

function closeRegistrationDialog(): void {
  if (importBusy.value) return
  registrationDialogOpen.value = false
  importError.value = ''
}

async function registerIconSet(request: ProjectIconRegistrationRequest): Promise<void> {
  if (!document.value || importBusy.value) return
  importError.value = ''
  importBusy.value = true
  try {
    const iconSeries = [...(document.value.iconSeries ?? [])]
    if (iconSeries.some(series => series.key.toLocaleLowerCase() === request.key.toLocaleLowerCase())) {
      importError.value = t('projectConfig.icons.iconSetKeyExists')
      return
    }
    const imported = await projectStore.importProjectIconFile(
      request.sourcePath,
      request.targetDirectory,
      request.conflictResolution,
    )
    iconSeries.push({
      name: request.name,
      key: request.key,
      source: imported.source,
      grid: { ...DEFAULT_PROJECT_ICON_GRID_SETTINGS },
      icons: [],
    })
    updateIconSeries(iconSeries)
    await nextTick()
    await workbenchRef.value?.selectSeries(request.key)
    registrationDialogOpen.value = false
    importError.value = ''
  } catch (error) {
    reportAppError('OC-E3011', error)
    importError.value = t('projectConfig.icons.importFailed')
  } finally {
    importBusy.value = false
  }
}

function updateRawSource(content: string): void {
  emit('update:modelValue', content)
}

function save(): void {
  if (document.value && keyConflicts.value.length === 0) emit('save')
}

function isNavigationToken(token: SessionNavigationToken): token is {
  protocol: 'icon-registry'
  version: 1
  target:
    | { kind: 'series-key'; seriesIndex: number; key: string }
    | { kind: 'icon-key'; seriesIndex: number; iconIndex: number; key: string }
} {
  if (!token || typeof token !== 'object' || Array.isArray(token)) return false
  const candidate = token as Record<string, unknown>
  const target = candidate.target
  if (candidate.protocol !== 'icon-registry' || candidate.version !== 1
    || !target || typeof target !== 'object' || Array.isArray(target)) return false
  const value = target as Record<string, unknown>
  return (value.kind === 'series-key' || value.kind === 'icon-key')
    && Number.isInteger(value.seriesIndex)
    && typeof value.key === 'string'
    && (value.kind === 'series-key' || Number.isInteger(value.iconIndex))
}

async function navigate(token: SessionNavigationToken): Promise<EditorNavigationResult> {
  if (!isNavigationToken(token)) return 'invalid-token'
  await nextTick()
  const conflict: ProjectIconKeyConflict = token.target.kind === 'series-key'
    ? { kind: 'series', seriesIndex: token.target.seriesIndex, key: token.target.key }
    : {
        kind: 'icon',
        seriesIndex: token.target.seriesIndex,
        iconIndex: token.target.iconIndex,
        key: token.target.key,
      }
  return await workbenchRef.value?.navigateToKeyConflict(conflict) ? 'success' : 'not-found'
}

defineExpose({ save, navigate })
</script>
