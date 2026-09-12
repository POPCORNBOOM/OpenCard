<template>
  <div class="project-icon-registry-workbench">
    <section class="project-icon-registry-workbench__left">
      <div class="project-icon-registry-workbench__series-list">
        <OcEmpty v-if="series.length === 0" tone="muted">{{ t('projectConfig.icons.empty') }}</OcEmpty>
        <ProjectConfigSection v-for="(candidate, index) in series" :key="candidate.key"
          :section-id="`project-icon-series-${index}`" :heading="candidate.name"
          :description="t('projectConfig.icons.iconCount', { count: candidate.icons.length })"
          :collapsed="selectedSeriesIndex !== index"
          :expand-label="t('projectConfig.sections.expand', { section: candidate.name })"
          :collapse-label="t('projectConfig.sections.collapse', { section: candidate.name })"
          @toggle="toggleSeries(index)">
          <template #heading-actions>
            <OcText as="span" tone="muted" size="sm">
              {{ t('projectConfig.icons.iconCount', { count: candidate.icons.length }) }}
            </OcText>
          </template>
          <template #actions>
            <OcButton icon-only size="sm" icon="action.export" variant="ghost"
              :disabled="selectedSeriesIndex !== index || packBusy"
              :aria-label="t('projectConfig.icons.exportPack')"
              :data-tooltip="t('projectConfig.icons.exportPack')"
              @click.stop="exportIconPack(index)" />
            <OcButton icon-only size="sm" icon="tool.settings" variant="ghost"
              :aria-label="t('projectConfig.icons.configureIconSet')"
              :data-tooltip="t('projectConfig.icons.configureIconSet')"
              @click.stop="openSettingsDialog(index)" />
            <OcButton icon-only size="sm" icon="action.delete" icon-tone="danger" variant="ghost"
              :aria-label="t('projectConfig.icons.removeSeries')"
              :data-tooltip="t('projectConfig.icons.removeSeries')"
              @click.stop="removeSeries(index)" />
          </template>
          <ProjectIconSetWorkspace v-if="selectedSeriesIndex === index" :ref="captureSetWorkspace"
            :series="candidate" :entries="selectedSeriesEntries" :selected-icon-indexes="selectedIconIndexesForSeries"
            @update:series="updateSelectedSeries" @update:selected-icon-indexes="setSelectedIconIndexes" />
        </ProjectConfigSection>
      </div>
    </section>

    <section class="project-icon-registry-workbench__right">
      <template v-if="selectedSeries">
        <div class="project-icon-registry-workbench__stage">
          <OcText v-if="selectedSeriesLoadError" class="project-icon-registry-workbench__load-error"
            tone="danger" size="sm">{{ t('projectConfig.icons.imageLoadFailed') }}</OcText>
          <ProjectIconView v-if="selectedCatalogEntry" class="project-icon-registry-workbench__stage-icon"
            :entry="selectedCatalogEntry" mode="preview" />
          <OcEmpty v-else tone="muted" inset="none">{{ t('projectConfig.icons.noIconSelected') }}</OcEmpty>
        </div>
        <OcViewportInspector v-model:expanded="previewPanelExpanded" v-model:height="previewPanelHeight"
          class="project-icon-registry-workbench__preview-pane" :heading="t('projectConfig.icons.preview')"
          :expand-label="t('app.shell.expandBottomPanel')" :collapse-label="t('app.shell.collapseBottomPanel')"
          :resize-label="t('projectConfig.icons.resizePreview')">
          <div class="project-icon-registry-workbench__preview-content">
            <OcText as="strong">{{ selectedIcon?.name ?? t('projectConfig.icons.noIconSelected') }}</OcText>
            <ProjectIconView v-if="selectedCatalogEntry" class="project-icon-registry-workbench__preview-icon"
              :entry="selectedCatalogEntry" mode="preview" />
            <OcText v-else tone="muted" size="sm">{{ t('projectConfig.icons.noIconSelected') }}</OcText>
          </div>
        </OcViewportInspector>
      </template>
      <div v-else class="project-icon-registry-workbench__placeholder">
        <OcIcon name="file.project-icon" size="lg" tone="muted" />
        <OcEmpty tone="muted" inset="none">{{ t('projectConfig.icons.noSeriesSelected') }}</OcEmpty>
      </div>
    </section>

    <ProjectIconSetSettingsDialog :open="settingsSeriesIndex !== null" :name="settingsSeries?.name"
      :series-key="settingsSeries?.key" :busy="settingsBusy"
      :existing-keys="series.map(candidate => candidate.key)"
      @close="settingsSeriesIndex = null" @submit="saveIconSetSettings" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  findProjectIconKeyConflicts,
  type ProjectIconKeyConflict,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import ProjectIconView from '../../features/workspace/components/ProjectIconView.vue'
import {
  buildProjectIconCatalog,
  findProjectIcon,
  findProjectIconSeries,
  type ProjectIconCatalog,
  type ProjectIconCatalogEntry,
} from '../../features/workspace/services/projectIconCatalog'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcViewportInspector from '../standard/OcViewportInspector.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import ProjectIconSetSettingsDialog, { type ProjectIconSetSettingsRequest } from './ProjectIconSetSettingsDialog.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

const props = withDefaults(defineProps<{
  series?: readonly ProjectIconSeries[]
  resolveAssetSrc: (source: string) => string
  defaultOpenPath?: string
  projectIconCatalog?: ProjectIconCatalog
  /** An icon-pack task owns the global progress bar; pack commands stay disabled until it settles. */
  packBusy?: boolean
}>(), { series: () => [], packBusy: false })
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries[]]
  'key-conflicts': [conflicts: readonly ProjectIconKeyConflict[]]
  'export-pack': [series: ProjectIconSeries]
  /** Asks the owner to confirm and stage the removal; the workbench never drops a set on its own. */
  'remove-series': [seriesKey: string]
}>()
const { t } = useI18n()
const selectedSeriesKey = ref<string | null>(null)
const selectedIconIndexes = ref<Record<string, number[]>>({})
const settingsSeriesIndex = ref<number | null>(null)
const settingsBusy = ref(false)
const previewPanelExpanded = ref(true)
const previewPanelHeight = ref<number | null>(null)
const setWorkspaceRef = ref<InstanceType<typeof ProjectIconSetWorkspace> | null>(null)
const localCatalog = ref<ProjectIconCatalog>({ series: [], entries: [], errors: [] })
let initialized = false

const selectedSeriesIndex = computed(() => {
  if (selectedSeriesKey.value === null) return null
  const index = props.series.findIndex(candidate => candidate.key === selectedSeriesKey.value)
  return index >= 0 ? index : null
})
const selectedSeries = computed(() => selectedSeriesIndex.value === null
  ? null : props.series[selectedSeriesIndex.value] ?? null)
const selectedRuntime = computed(() => selectedSeries.value
  ? findProjectIconSeries(localCatalog.value, selectedSeries.value.key)
    ?? findProjectIconSeries(props.projectIconCatalog, selectedSeries.value.key)
  : null)
const selectedIconIndex = computed(() => {
  const current = selectedSeries.value
  if (!current) return null
  return selectedIconIndexes.value[current.key]?.find(index => current.icons[index]) ?? null
})
const selectedIconIndexesForSeries = computed(() => (
  selectedSeries.value ? selectedIconIndexes.value[selectedSeries.value.key] ?? [] : []
))
const selectedIcon = computed(() => selectedIconIndex.value === null
  ? null : selectedSeries.value?.icons[selectedIconIndex.value] ?? null)
const settingsSeries = computed(() => settingsSeriesIndex.value === null
  ? null : props.series[settingsSeriesIndex.value] ?? null)
const selectedSeriesEntries = computed<readonly ProjectIconCatalogEntry[]>(() => {
  const series = selectedSeries.value
  if (!series) return []
  const local = localCatalog.value.entries.filter(entry => sameIconSeries(entry.seriesKey, series.key))
  if (local.length) return local
  return (props.projectIconCatalog?.entries ?? []).filter(entry => sameIconSeries(entry.seriesKey, series.key))
})
const selectedSeriesLoadError = computed(() => {
  const series = selectedSeries.value
  if (!series) return false
  return [...localCatalog.value.errors, ...(props.projectIconCatalog?.errors ?? [])]
    .some(error => sameIconSeries(error.seriesKey, series.key))
})
const selectedCatalogEntry = computed<ProjectIconCatalogEntry | null>(() => {
  const series = selectedSeries.value
  const icon = selectedIcon.value
  if (!series || !icon) return null
  return findProjectIcon(localCatalog.value, series.key, icon.iconKey)
    ?? findProjectIcon(props.projectIconCatalog, series.key, icon.iconKey)
})
const conflicts = computed(() => findProjectIconKeyConflicts(props.series))

watch(() => props.series, nextSeries => {
  if (!initialized) {
    selectedSeriesKey.value = nextSeries[0]?.key ?? null
    initialized = true
  } else if (selectedSeriesKey.value !== null
    && !nextSeries.some(candidate => candidate.key === selectedSeriesKey.value)) {
    selectedSeriesKey.value = nextSeries[0]?.key ?? null
  }
  const nextSelections: Record<string, number[]> = {}
  for (const candidate of nextSeries) {
    const selected = selectedIconIndexes.value[candidate.key] ?? []
    const valid = selected.filter(index => candidate.icons[index])
    nextSelections[candidate.key] = valid.length ? valid : candidate.icons.length ? [0] : []
  }
  selectedIconIndexes.value = nextSelections
}, { immediate: true })
watch(() => seriesCatalogIdentity(selectedSeries.value),
  identity => {
    if (identity === null || !selectedSeries.value) {
      localCatalog.value = { series: [], entries: [], errors: [] }
      return
    }
    // Assembling the catalog is pure data: an icon's size is resolved when it is painted.
    localCatalog.value = buildProjectIconCatalog([selectedSeries.value], props.resolveAssetSrc)
  }, { immediate: true })
watch(conflicts, value => emit('key-conflicts', value), { immediate: true })

function sameIconSeries(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase()
}

/** Identity of everything the local catalog reads for the selected set: every icon's own file. */
function seriesCatalogIdentity(series: ProjectIconSeries | null): string | null {
  if (!series) return null
  return `${series.key}\u0000${series.icons.map(icon => `${icon.iconKey}:${icon.source}`).join('\u0001')}`
}

function selectSeriesByIndex(index: number): void {
  const candidate = props.series[index]
  if (!candidate) return
  selectedSeriesKey.value = candidate.key
  if (selectedIconIndexes.value[candidate.key] == null && candidate.icons.length) {
    selectedIconIndexes.value[candidate.key] = [0]
  }
}
function toggleSeries(index: number): void {
  if (selectedSeriesIndex.value === index) selectedSeriesKey.value = null
  else selectSeriesByIndex(index)
}
function setSelectedIconIndexes(indexes: number[]): void {
  if (selectedSeriesKey.value !== null) selectedIconIndexes.value[selectedSeriesKey.value] = [...indexes]
}
function updateSelectedSeries(nextSeries: ProjectIconSeries): void {
  const index = selectedSeriesIndex.value
  if (index === null) return
  const next = [...props.series]
  next[index] = nextSeries
  emit('update:series', next)
}
function exportIconPack(index: number): void {
  const candidate = props.series[index]
  if (candidate) emit('export-pack', candidate)
}
function openSettingsDialog(index: number): void {
  if (props.series[index]) settingsSeriesIndex.value = index
}
async function saveIconSetSettings(request: ProjectIconSetSettingsRequest): Promise<void> {
  const index = settingsSeriesIndex.value
  const current = index === null ? null : props.series[index]
  if (index === null || !current) return
  settingsBusy.value = true
  try {
    const next = [...props.series]
    next[index] = { ...current, name: request.name, key: request.key }
    if (selectedSeriesKey.value === current.key) {
      selectedSeriesKey.value = request.key
      selectedIconIndexes.value[request.key] = selectedIconIndexes.value[current.key] ?? []
      delete selectedIconIndexes.value[current.key]
    }
    settingsSeriesIndex.value = null
    emit('update:series', next)
  } finally {
    settingsBusy.value = false
  }
}
function removeSeries(index: number): void {
  const removed = props.series[index]
  if (!removed) return
  emit('remove-series', removed.key)
}
function captureSetWorkspace(instance: unknown): void {
  setWorkspaceRef.value = instance as InstanceType<typeof ProjectIconSetWorkspace> | null
}
async function selectSeries(seriesKey: string): Promise<boolean> {
  await nextTick()
  const index = props.series.findIndex(candidate => candidate.key === seriesKey)
  if (index < 0) return false
  selectSeriesByIndex(index)
  return true
}
async function navigateToKeyConflict(conflict: ProjectIconKeyConflict): Promise<boolean> {
  const candidate = props.series[conflict.seriesIndex]
  if (!candidate) return false
  selectSeriesByIndex(conflict.seriesIndex)
  if (conflict.kind === 'series') {
    openSettingsDialog(conflict.seriesIndex)
    return true
  }
  if (!candidate.icons[conflict.iconIndex]) return false
  setSelectedIconIndexes([conflict.iconIndex])
  await nextTick()
  return await setWorkspaceRef.value?.activateIconKey(conflict.iconIndex) ?? false
}

defineExpose({ selectSeries, navigateToKeyConflict, selectedRuntime })
</script>

<style scoped>
.project-icon-registry-workbench {
  display: grid;
  grid-template-columns: minmax(var(--oc-project-icon-property-min-width), var(--oc-project-icon-workbench-series-width)) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--oc-bg-inset);
}
.project-icon-registry-workbench__left,
.project-icon-registry-workbench__right { min-width: 0; min-height: 0; overflow: hidden; }
.project-icon-registry-workbench__left {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-right: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}
.project-icon-registry-workbench__series-list {
  min-height: 0;
  overflow: auto;
  padding: 0 var(--oc-space-5) var(--oc-space-5);
}
.project-icon-registry-workbench__right {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
}
.project-icon-registry-workbench__stage {
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  padding: var(--oc-space-4);
  background-color: var(--oc-bg-raised);
  background-image: var(--oc-viewport-dot-pattern);
  background-size: var(--oc-viewport-dot-size);
  background-position: var(--oc-viewport-dot-position);
}
.project-icon-registry-workbench__stage-icon {
  font-size: var(--oc-project-icon-preview-size);
}
.project-icon-registry-workbench__load-error {
  position: absolute; top: var(--oc-space-2); left: 50%; z-index: var(--oc-z-overlay-toolbar);
  transform: translateX(-50%);
}
.project-icon-registry-workbench__preview-pane {
  --oc-viewport-inspector-default-height: var(--oc-project-icon-atlas-height);
}
.project-icon-registry-workbench__preview-content {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  gap: var(--oc-space-2);
  overflow: hidden;
}
.project-icon-registry-workbench__preview-icon {
  align-self: center;
  font-size: var(--oc-project-icon-preview-size);
}
.project-icon-registry-workbench__placeholder {
  display: grid; grid-row: 1 / -1; place-content: center; justify-items: center;
  gap: var(--oc-space-3); min-width: 0; min-height: 0;
}
</style>
