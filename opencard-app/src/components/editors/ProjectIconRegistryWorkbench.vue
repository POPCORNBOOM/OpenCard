<template>
  <div class="project-icon-registry-workbench">
    <section class="project-icon-registry-workbench__left">
      <header class="project-icon-registry-workbench__titlebar">
        <div class="project-icon-registry-workbench__title">
          <OcIcon name="file.package-variant" size="lg" />
          <div>
            <h1>{{ heading }}</h1>
            <OcText tone="muted" size="sm">{{ description }}</OcText>
          </div>
        </div>
        <div v-if="!readOnly" class="project-icon-registry-workbench__title-actions">
          <OcButton icon="action.add" variant="soft"
            :aria-label="t('projectConfig.icons.createPack')" @click="emit('create-pack')">
            {{ t('projectConfig.icons.createPack') }}
          </OcButton>
          <OcButton icon="action.import" variant="soft"
            :aria-label="t('projectConfig.icons.importPack')" @click="emit('import-pack')">
            {{ t('projectConfig.icons.importPack') }}
          </OcButton>
        </div>
      </header>

      <OcText v-if="error" class="project-icon-registry-workbench__error" tone="danger" size="sm">
        {{ error }}
      </OcText>
      <div class="project-icon-registry-workbench__series-list">
        <OcEmpty v-if="displaySeries.length === 0" tone="muted">{{ t('projectConfig.icons.empty') }}</OcEmpty>
        <ProjectConfigSection v-for="(candidate, index) in displaySeries" :key="candidate.key"
          :section-id="`project-icon-series-${index}`" :heading="candidate.name"
          :description="candidate.source" :collapsed="selectedSeriesIndex !== index"
          :expand-label="t('projectConfig.sections.expand', { section: candidate.name })"
          :collapse-label="t('projectConfig.sections.collapse', { section: candidate.name })"
          @toggle="toggleSeries(index)">
          <template #heading-actions>
            <span v-if="comparisonMarker(candidate)" class="project-icon-registry-workbench__change-markers">
              <OcIcon v-if="comparisonMarker(candidate)?.historical" name="status.change-removed" size="sm" tone="danger" />
              <OcIcon v-if="comparisonMarker(candidate)?.current" name="status.change-added" size="sm" tone="success" />
            </span>
            <OcText as="span" tone="muted" size="sm">
              {{ t('projectConfig.icons.iconCount', { count: candidate.icons.length }) }}
            </OcText>
          </template>
          <template #actions>
          <OcButton v-if="!readOnly" icon-only size="sm" icon="action.export" variant="ghost"
              :disabled="selectedSeriesIndex !== index || !selectedRuntime"
              :aria-label="t('projectConfig.icons.exportPack')"
              :data-tooltip="t('projectConfig.icons.exportPack')"
              @click.stop="exportIconPack(index)" />
          <OcButton v-if="!readOnly" icon-only size="sm" icon="action.image-plus" variant="ghost"
              :disabled="selectedSeriesIndex !== index || !selectedRuntime"
              :aria-label="t('projectConfig.icons.addSingleCrop')"
              :data-tooltip="t('projectConfig.icons.addSingleCrop')"
              @click.stop="addSingleCrop(index)" />
          <OcButton v-if="!readOnly" icon-only size="sm" icon="tool.grid" variant="ghost"
              :disabled="selectedSeriesIndex !== index || !selectedRuntime"
              :aria-label="t('projectConfig.icons.generateIcons')"
              :data-tooltip="t('projectConfig.icons.generateIcons')"
              @click.stop="openGridDialog(index)" />
          <OcButton v-if="!readOnly" icon-only size="sm" icon="tool.settings" variant="ghost"
              :aria-label="t('projectConfig.icons.configureIconSet')"
              :data-tooltip="t('projectConfig.icons.configureIconSet')"
              @click.stop="openSettingsDialog(index)" />
          <OcButton v-if="!readOnly" icon-only size="sm" icon="action.delete" icon-tone="danger" variant="ghost"
              :aria-label="t('projectConfig.icons.removeSeries')"
              :data-tooltip="t('projectConfig.icons.removeSeries')"
            @click.stop="removeSeries(index)" />
          </template>
          <ProjectIconSetWorkspace v-if="selectedSeriesIndex === index" :ref="captureSetWorkspace"
            :series="currentSeries ?? { ...candidate, icons: [] }" :runtime="currentRuntime"
            :comparison-series="historicalSeries ?? undefined" :comparison-runtime="historicalRuntime"
            :comparison="isComparison" :current-missing="isComparison && !currentSeries"
            :selected-icon-indexes="selectedIconIndexesForSeries"
            :read-only="readOnly"
            @update:series="updateSelectedSeries" @update:selected-icon-indexes="setSelectedIconIndexes" />
        </ProjectConfigSection>
      </div>
    </section>

    <section class="project-icon-registry-workbench__right">
      <template v-if="selectedSeries">
        <div class="project-icon-registry-workbench__atlas-pane" :class="{ 'is-comparison': isComparison }">
          <section v-if="isComparison" class="project-icon-registry-workbench__compare-pane is-historical">
            <header>A · {{ t('versioning.diff.historical') }}</header>
            <ProjectIconCropEditor v-if="historicalSeries" fill :runtime="historicalRuntime" :icon="historicalIcon"
              :alt="historicalSeries.name" :snap-to-grid="gridSettings.snapToGrid" :grid-rows="gridSettings.rows"
              :grid-columns="gridSettings.columns" :pixelated="gridSettings.pixelated"
              :pixelated-label="t('projectConfig.icons.pixelated')" :grid-label="t('projectConfig.icons.showGrid')"
              :focus-selected-label="t('projectConfig.icons.autoFocusSelected')"
              :move-label="t('projectConfig.icons.moveCrop')" :handle-labels="cropHandleLabels" read-only />
            <OcEmpty v-else tone="muted">{{ t('versioning.diff.missing') }}</OcEmpty>
          </section>
          <section class="project-icon-registry-workbench__compare-pane">
            <header v-if="isComparison">B · {{ t('versioning.diff.current') }}</header>
            <OcText v-if="selectedSeriesLoadError" class="project-icon-registry-workbench__load-error"
              tone="danger" size="sm">{{ t('projectConfig.icons.imageLoadFailed') }}</OcText>
            <ProjectIconCropEditor v-if="currentSeries" fill :runtime="currentRuntime" :icon="currentIcon"
              :alt="currentSeries.name" :snap-to-grid="gridSettings.snapToGrid" :grid-rows="gridSettings.rows"
              :grid-columns="gridSettings.columns" :pixelated="gridSettings.pixelated"
              :pixelated-label="t('projectConfig.icons.pixelated')" :grid-label="t('projectConfig.icons.showGrid')"
              :focus-selected-label="t('projectConfig.icons.autoFocusSelected')"
              :move-label="t('projectConfig.icons.moveCrop')" :handle-labels="cropHandleLabels"
              :read-only="readOnly" @update:icon="updateSelectedIcon"
              @update:pixelated="updateGridSettings({ pixelated: $event })" />
            <OcEmpty v-else tone="muted">{{ t('versioning.diff.missing') }}</OcEmpty>
          </section>
          <OcOverlayToolbar class="project-icon-registry-workbench__grid-toolbar"
            :label="t('projectConfig.icons.gridSettings')">
            <OcButton v-if="!readOnly" icon-only size="sm" icon="tool.snap-grid" :active="gridSettings.snapToGrid"
              :aria-pressed="gridSettings.snapToGrid" :variant="gridSettings.snapToGrid ? 'soft' : 'ghost'"
              :aria-label="t('projectConfig.icons.snapToGrid')"
              :data-tooltip="t('projectConfig.icons.snapToGrid')" @click="toggleGridSnapping" />
            <OcFieldFrame v-if="!readOnly" class="project-icon-registry-workbench__grid-field" size="sm">
              <template #prefix><OcIcon name="layout.rows" size="sm" tone="muted" /></template>
              <OcFieldInput variant="plain" size="sm" type="number" min="1" step="1"
                :value="gridSettings.rows" :aria-label="t('projectConfig.icons.rows')"
                @change="updateGridDimension('rows', $event)" />
            </OcFieldFrame>
            <OcFieldFrame v-if="!readOnly" class="project-icon-registry-workbench__grid-field" size="sm">
              <template #prefix><OcIcon name="layout.columns" size="sm" tone="muted" /></template>
              <OcFieldInput variant="plain" size="sm" type="number" min="1" step="1"
                :value="gridSettings.columns" :aria-label="t('projectConfig.icons.columns')"
                @change="updateGridDimension('columns', $event)" />
            </OcFieldFrame>
          </OcOverlayToolbar>
        </div>
        <div class="project-icon-registry-workbench__preview-pane" :class="{ 'is-comparison': isComparison }">
          <section v-if="isComparison">
            <header>A · {{ t('versioning.diff.historical') }}</header>
            <OcText as="strong">{{ historicalIcon?.name ?? t('projectConfig.icons.noIconSelected') }}</OcText>
            <ProjectIconView v-if="historicalCatalogEntry" class="project-icon-registry-workbench__preview-icon"
              :entry="historicalCatalogEntry" mode="preview" />
            <OcEmpty v-else tone="muted">{{ t('versioning.diff.missing') }}</OcEmpty>
          </section>
          <section>
            <header v-if="isComparison">B · {{ t('versioning.diff.current') }}</header>
            <OcText as="strong">{{ currentIcon?.name ?? t('projectConfig.icons.noIconSelected') }}</OcText>
            <ProjectIconView v-if="currentCatalogEntry" class="project-icon-registry-workbench__preview-icon"
              :entry="currentCatalogEntry" mode="preview" />
            <OcEmpty v-else tone="muted">{{ isComparison ? t('versioning.diff.missing') : t('projectConfig.icons.noIconSelected') }}</OcEmpty>
          </section>
        </div>
      </template>
      <div v-else class="project-icon-registry-workbench__placeholder">
        <OcIcon name="file.package-variant" size="lg" tone="muted" />
        <OcEmpty tone="muted" inset="none">{{ t('projectConfig.icons.noSeriesSelected') }}</OcEmpty>
      </div>
    </section>

    <ProjectIconSetSettingsDialog :open="settingsSeriesIndex !== null" :name="settingsSeries?.name"
      :series-key="settingsSeries?.key" :source="settingsSeries?.source"
      :existing-keys="displaySeries.map(candidate => candidate.key)"
      @close="settingsSeriesIndex = null" @submit="saveIconSetSettings" />
    <ProjectIconGridDialog :open="gridDialogOpen" :has-icons="Boolean(selectedSeries?.icons.length)"
      :initial-rows="gridSettings.rows" :initial-columns="gridSettings.columns"
      :initial-pixelated="gridSettings.pixelated" :image-src="selectedRuntime?.src"
      :image-width="selectedRuntime?.imageWidth" :image-height="selectedRuntime?.imageHeight"
      @close="gridDialogOpen = false" @submit="generateIcons" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  appendProjectIconCrop,
  DEFAULT_PROJECT_ICON_GRID_SETTINGS,
  findProjectIconKeyConflicts,
  generateProjectIconGrid,
  type ProjectIcon,
  type ProjectIconGridSettings,
  type ProjectIconKeyConflict,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import ProjectIconView from '../../features/workspace/components/ProjectIconView.vue'
import {
  buildProjectIconCatalog,
  findProjectIconSeries,
  type ProjectIconCatalog,
  type ProjectIconCatalogEntry,
} from '../../features/workspace/services/projectIconCatalog'
import { orderedPair } from '../../shared/model/orderedPair'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import ProjectIconCropEditor, { type ProjectIconCropHandle } from './ProjectIconCropEditor.vue'
import ProjectIconGridDialog, { type ProjectIconGridRequest } from './ProjectIconGridDialog.vue'
import ProjectIconSetSettingsDialog, { type ProjectIconSetSettingsRequest } from './ProjectIconSetSettingsDialog.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

const props = withDefaults(defineProps<{
  heading: string
  description: string
  series?: readonly ProjectIconSeries[]
  comparison?: boolean
  comparisonSeries?: readonly ProjectIconSeries[]
  resolveAssetSrc: (source: string) => string
  comparisonResolveAssetSrc?: (source: string) => string
  projectIconCatalog?: ProjectIconCatalog
  error?: string
  readOnly?: boolean
}>(), { series: () => [], error: '', readOnly: false })
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries[]]
  'key-conflicts': [conflicts: readonly ProjectIconKeyConflict[]]
  'create-pack': []
  'import-pack': []
  'export-pack': [series: ProjectIconSeries]
}>()
const { t } = useI18n()
const selectedSeriesKey = ref<string | null>(null)
const selectedIconIndexes = ref<Record<string, number[]>>({})
const settingsSeriesIndex = ref<number | null>(null)
const gridDialogOpen = ref(false)
const setWorkspaceRef = ref<InstanceType<typeof ProjectIconSetWorkspace> | null>(null)
const localCatalog = ref<ProjectIconCatalog>({ series: [], entries: [], errors: [] })
const historicalCatalog = ref<ProjectIconCatalog>({ series: [], entries: [], errors: [] })
let catalogVersion = 0
let initialized = false

const isComparison = computed(() => props.comparison === true)
const displaySeries = computed<readonly ProjectIconSeries[]>(() => {
  if (!isComparison.value) return props.series
  return orderedPair(props.comparisonSeries ?? [], props.series,
    candidate => candidate.key.toLocaleLowerCase())
    .flatMap(pair => pair.rightItem ? [pair.rightItem] : pair.leftItem ? [pair.leftItem] : [])
})
function findSeriesByKey(seriesList: readonly ProjectIconSeries[] | undefined, key: string | null): ProjectIconSeries | null {
  if (key === null) return null
  return seriesList?.find(candidate => candidate.key.toLocaleLowerCase() === key.toLocaleLowerCase()) ?? null
}
function sameSeries(left: ProjectIconSeries | null, right: ProjectIconSeries | null): boolean {
  return left !== null && right !== null && JSON.stringify(left) === JSON.stringify(right)
}
function comparisonMarker(candidate: ProjectIconSeries): { historical: boolean; current: boolean } | null {
  if (!isComparison.value) return null
  const current = findSeriesByKey(props.series, candidate.key)
  const historical = findSeriesByKey(props.comparisonSeries, candidate.key)
  if (sameSeries(current, historical)) return null
  return { historical: historical !== null, current: current !== null }
}
const selectedSeriesIndex = computed(() => {
  if (selectedSeriesKey.value === null) return null
  const index = displaySeries.value.findIndex(candidate => candidate.key === selectedSeriesKey.value)
  return index >= 0 ? index : null
})
const selectedSeries = computed(() => selectedSeriesIndex.value === null
  ? null : displaySeries.value[selectedSeriesIndex.value] ?? null)
const currentSeries = computed(() => findSeriesByKey(props.series, selectedSeriesKey.value))
const historicalSeries = computed(() => findSeriesByKey(props.comparisonSeries, selectedSeriesKey.value))
const currentRuntime = computed(() => currentSeries.value
  ? findProjectIconSeries(localCatalog.value, currentSeries.value.key)
    ?? findProjectIconSeries(props.projectIconCatalog, currentSeries.value.key)
  : null)
const historicalRuntime = computed(() => historicalSeries.value
  ? findProjectIconSeries(historicalCatalog.value, historicalSeries.value.key)
  : null)
const selectedRuntime = computed(() => currentRuntime.value ?? historicalRuntime.value)
const displayIcons = computed<readonly ProjectIcon[]>(() => {
  const current = [...(currentSeries.value?.icons ?? [])]
  if (!isComparison.value) return current
  return orderedPair(historicalSeries.value?.icons ?? [], current,
    icon => icon.iconKey.toLocaleLowerCase())
    .flatMap(pair => pair.rightItem ? [pair.rightItem] : pair.leftItem ? [pair.leftItem] : [])
})
const selectedIconIndex = computed(() => {
  if (!selectedSeries.value) return null
  return selectedIconIndexes.value[selectedSeries.value.key]?.find(index => displayIcons.value[index]) ?? null
})
const selectedIconKey = computed(() => selectedIconIndex.value === null
  ? null : displayIcons.value[selectedIconIndex.value]?.iconKey ?? null)
function findIconByKey(series: ProjectIconSeries | null, key: string | null): ProjectIcon | null {
  if (key === null) return null
  return series?.icons.find(icon => icon.iconKey.toLocaleLowerCase() === key.toLocaleLowerCase()) ?? null
}
const currentIcon = computed(() => selectedIconIndex.value === null
  ? null : findIconByKey(currentSeries.value, selectedIconKey.value))
const historicalIcon = computed(() => selectedIconIndex.value === null
  ? null : findIconByKey(historicalSeries.value, selectedIconKey.value))
const selectedIconIndexesForSeries = computed(() => (
  selectedSeries.value ? selectedIconIndexes.value[selectedSeries.value.key] ?? [] : []
))
const settingsSeries = computed(() => settingsSeriesIndex.value === null
  ? null : findSeriesByKey(props.series, displaySeries.value[settingsSeriesIndex.value]?.key ?? null))
const gridSettings = computed<Readonly<ProjectIconGridSettings>>(() => (
  selectedSeries.value?.grid ?? DEFAULT_PROJECT_ICON_GRID_SETTINGS
))
const selectedSeriesLoadError = computed(() => currentSeries.value
  ? [...localCatalog.value.errors, ...(props.projectIconCatalog?.errors ?? [])].some(error => (
      error.seriesKey.toLocaleLowerCase() === currentSeries.value!.key.toLocaleLowerCase()
      && error.reason === 'load-failed'
    ))
  : false)
function toCatalogEntry(icon: ProjectIcon | null, series: ProjectIconSeries | null,
  runtime: ReturnType<typeof findProjectIconSeries>): ProjectIconCatalogEntry | null {
  if (!icon || !runtime || icon.x + icon.width > runtime.imageWidth
    || icon.y + icon.height > runtime.imageHeight) return null
  return { ...icon, seriesKey: series?.key ?? '', source: runtime.source, src: runtime.src,
    imageWidth: runtime.imageWidth, imageHeight: runtime.imageHeight }
}
const currentCatalogEntry = computed(() => toCatalogEntry(currentIcon.value, currentSeries.value, currentRuntime.value))
const historicalCatalogEntry = computed(() => toCatalogEntry(historicalIcon.value, historicalSeries.value, historicalRuntime.value))
const conflicts = computed(() => findProjectIconKeyConflicts(props.series))
const cropHandleLabels = computed<Record<ProjectIconCropHandle, string>>(() => Object.fromEntries(
  (['lt', 't', 'rt', 'r', 'rb', 'b', 'lb', 'l'] as const).map(handle => [
    handle, t('projectConfig.icons.resizeCrop', { handle: t(`projectConfig.icons.handles.${handle}`) }),
  ]),
) as Record<ProjectIconCropHandle, string>)

watch(() => [props.series, props.comparisonSeries, isComparison.value] as const, () => {
  if (!initialized) {
    selectedSeriesKey.value = displaySeries.value[0]?.key ?? null
    initialized = true
  } else if (selectedSeriesKey.value !== null
    && !displaySeries.value.some(candidate => candidate.key === selectedSeriesKey.value)) {
    selectedSeriesKey.value = displaySeries.value[0]?.key ?? null
  }
  const nextSelections: Record<string, number[]> = {}
  for (const candidate of displaySeries.value) {
    const selected = selectedIconIndexes.value[candidate.key] ?? []
    const current = findSeriesByKey(props.series, candidate.key)
    const historical = findSeriesByKey(props.comparisonSeries, candidate.key)
    const icons = orderedPair(historical?.icons ?? [], current?.icons ?? [],
      icon => icon.iconKey.toLocaleLowerCase())
      .flatMap(pair => pair.rightItem ? [pair.rightItem] : pair.leftItem ? [pair.leftItem] : [])
    const valid = selected.filter(index => icons[index])
    nextSelections[candidate.key] = valid.length ? valid : icons.length ? [0] : []
  }
  selectedIconIndexes.value = nextSelections
}, { immediate: true })
watch(() => {
  const current = currentSeries.value
  const historical = historicalSeries.value
  return `${current?.key ?? ''}\u0000${current?.source ?? ''}\u0000${historical?.key ?? ''}\u0000${historical?.source ?? ''}`
}, async identity => {
  const version = ++catalogVersion
  const current = currentSeries.value
  const historical = historicalSeries.value
  if (!current && !historical) {
      localCatalog.value = { series: [], entries: [], errors: [] }
    historicalCatalog.value = { series: [], entries: [], errors: [] }
      return
    }
  const [nextCurrent, nextHistorical] = await Promise.all([
    current ? buildProjectIconCatalog([current], props.resolveAssetSrc)
      : Promise.resolve({ series: [], entries: [], errors: [] }),
    historical && props.comparisonResolveAssetSrc
      ? buildProjectIconCatalog([historical], props.comparisonResolveAssetSrc)
      : Promise.resolve({ series: [], entries: [], errors: [] }),
  ])
  if (identity !== `${currentSeries.value?.key ?? ''}\u0000${currentSeries.value?.source ?? ''}\u0000${historicalSeries.value?.key ?? ''}\u0000${historicalSeries.value?.source ?? ''}`
    || version !== catalogVersion) return
  localCatalog.value = nextCurrent
  historicalCatalog.value = nextHistorical
}, { immediate: true })
watch(conflicts, value => emit('key-conflicts', value), { immediate: true })

function selectSeriesByIndex(index: number): void {
  const candidate = displaySeries.value[index]
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
  if (props.readOnly) return
  const index = props.series.findIndex(candidate => candidate.key === selectedSeriesKey.value)
  if (index < 0) return
  const next = [...props.series]
  next[index] = nextSeries
  emit('update:series', next)
}
function updateSelectedIcon(icon: ProjectIcon): void {
  if (props.readOnly) return
  const series = selectedSeries.value
  const index = selectedIconIndex.value
  if (!series || index === null) return
  const icons = [...series.icons]
  icons[index] = icon
  updateSelectedSeries({ ...series, icons })
}
function updateGridSettings(patch: Partial<ProjectIconGridSettings>): void {
  if (props.readOnly) return
  if (selectedSeries.value) updateSelectedSeries({
    ...selectedSeries.value,
    grid: { ...gridSettings.value, ...patch },
  })
}
function toggleGridSnapping(): void {
  updateGridSettings({ snapToGrid: !gridSettings.value.snapToGrid })
}
function updateGridDimension(field: 'rows' | 'columns', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number(event.target.value)
  if (Number.isInteger(value) && value > 0) updateGridSettings({ [field]: value })
}
function openGridDialog(index: number): void {
  selectSeriesByIndex(index)
  if (selectedRuntime.value) gridDialogOpen.value = true
}
function addSingleCrop(index: number): void {
  const series = props.series[index]
  if (!series) return
  selectSeriesByIndex(index)
  const runtime = selectedRuntime.value
  if (!runtime) return
  const nextSeries = appendProjectIconCrop({
    series,
    imageWidth: runtime.imageWidth,
    imageHeight: runtime.imageHeight,
    rows: gridSettings.value.rows,
    columns: gridSettings.value.columns,
    name: t('projectConfig.icons.defaultIconName', { index: series.icons.length + 1 }),
    pixelated: gridSettings.value.pixelated,
  })
  if (!nextSeries) return
  updateSelectedSeries(nextSeries)
  setSelectedIconIndexes([series.icons.length])
}
function exportIconPack(index: number): void {
  const candidate = props.series[index]
  if (candidate) emit('export-pack', candidate)
}
function generateIcons(request: ProjectIconGridRequest): void {
  const series = selectedSeries.value
  const runtime = selectedRuntime.value
  if (!series || !runtime) return
  const mode = request.overwrite ? 'replace' : 'append'
  const generated = generateProjectIconGrid({
    series, imageWidth: runtime.imageWidth, imageHeight: runtime.imageHeight,
    rows: request.rows, columns: request.columns, mode, pixelated: request.pixelated,
    createName: ({ index }) => t('projectConfig.icons.defaultIconName', { index }),
  })
  if (!generated) return
  updateSelectedSeries({ ...generated, grid: { ...gridSettings.value, rows: request.rows,
    columns: request.columns, pixelated: request.pixelated } })
  setSelectedIconIndexes(generated.icons.length ? [mode === 'append' ? series.icons.length : 0] : [])
  gridDialogOpen.value = false
}
function openSettingsDialog(index: number): void {
  if (displaySeries.value[index]) settingsSeriesIndex.value = index
}
function saveIconSetSettings(request: ProjectIconSetSettingsRequest): void {
  const index = settingsSeriesIndex.value
  const current = index === null ? null : props.series[index]
  if (index === null || !current) return
  const next = [...props.series]
  next[index] = { ...current, name: request.name, key: request.key }
  if (selectedSeriesKey.value === current.key) {
    selectedSeriesKey.value = request.key
    selectedIconIndexes.value[request.key] = selectedIconIndexes.value[current.key] ?? []
    delete selectedIconIndexes.value[current.key]
  }
  settingsSeriesIndex.value = null
  emit('update:series', next)
}
function removeSeries(index: number): void {
  const removed = props.series[index]
  if (!removed) return
  const remaining = props.series.filter((_, candidateIndex) => candidateIndex !== index)
  if (selectedSeriesKey.value === removed.key) {
    selectedSeriesKey.value = remaining[Math.min(index, remaining.length - 1)]?.key ?? null
  }
  delete selectedIconIndexes.value[removed.key]
  settingsSeriesIndex.value = null
  emit('update:series', remaining)
}
function captureSetWorkspace(instance: unknown): void {
  setWorkspaceRef.value = instance as InstanceType<typeof ProjectIconSetWorkspace> | null
}
async function selectSeries(seriesKey: string): Promise<boolean> {
  await nextTick()
  const index = displaySeries.value.findIndex(candidate => candidate.key === seriesKey)
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

defineExpose({ selectSeries, navigateToKeyConflict })
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
  grid-template-rows: auto auto minmax(0, 1fr);
  border-right: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}
.project-icon-registry-workbench__titlebar,
.project-icon-registry-workbench__title { display: flex; align-items: center; }
.project-icon-registry-workbench__titlebar {
  justify-content: space-between;
  gap: var(--oc-space-4);
  padding: var(--oc-space-5);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
}
.project-icon-registry-workbench__title { min-width: 0; gap: var(--oc-space-3); }
.project-icon-registry-workbench__title-actions { display: flex; flex-wrap: wrap; gap: var(--oc-space-2); justify-content: flex-end; }
.project-icon-registry-workbench__title > div { display: grid; min-width: 0; gap: var(--oc-space-1); }
.project-icon-registry-workbench h1 {
  margin: 0;
  font-size: var(--oc-text-lg);
  font-weight: var(--font-weight-ui-title);
  letter-spacing: 0;
}
.project-icon-registry-workbench__error { padding: var(--oc-space-2) var(--oc-space-6); }
.project-icon-registry-workbench__series-list {
  min-height: 0;
  overflow: auto;
  padding: 0 var(--oc-space-5) var(--oc-space-5);
}
.project-icon-registry-workbench__right {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, var(--oc-project-icon-atlas-height));
}
.project-icon-registry-workbench__atlas-pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background-color: var(--oc-bg-raised);
  background-image: var(--oc-viewport-dot-pattern);
  background-size: var(--oc-viewport-dot-size);
  background-position: var(--oc-viewport-dot-position);
}
.project-icon-registry-workbench__atlas-pane.is-comparison {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.project-icon-registry-workbench__compare-pane {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.project-icon-registry-workbench__compare-pane + .project-icon-registry-workbench__compare-pane {
  border-left: var(--oc-border-width) solid var(--oc-border-muted);
}
.project-icon-registry-workbench__compare-pane > header,
.project-icon-registry-workbench__preview-pane section > header {
  position: absolute;
  top: var(--oc-space-2);
  left: var(--oc-space-3);
  z-index: var(--oc-z-overlay-toolbar);
  color: var(--oc-text-muted);
  font-size: var(--oc-text-xs);
}
.project-icon-registry-workbench__load-error {
  position: absolute; top: var(--oc-space-2); left: 50%; z-index: var(--oc-z-overlay-toolbar);
  transform: translateX(-50%);
}
.project-icon-registry-workbench__grid-toolbar {
  position: absolute; right: var(--oc-space-2); bottom: var(--oc-space-2); z-index: var(--oc-z-overlay-toolbar);
}
.project-icon-registry-workbench__grid-field {
  min-width: var(--oc-overlay-toolbar-field-min-width);
  max-width: var(--oc-overlay-toolbar-field-max-width);
}
.project-icon-registry-workbench__preview-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  justify-items: center;
  min-width: 0;
  min-height: 0;
  gap: var(--oc-space-2);
  padding: var(--oc-space-3);
  overflow: hidden;
  border-top: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-base);
}
.project-icon-registry-workbench__preview-pane.is-comparison {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr);
  align-items: center;
  gap: 0;
  padding: 0;
}
.project-icon-registry-workbench__preview-pane section {
  display: grid;
  align-content: center;
  justify-items: center;
  min-width: 0;
  min-height: 0;
  height: 100%;
  gap: var(--oc-space-2);
  padding: var(--oc-space-3);
}
.project-icon-registry-workbench__preview-pane section + section {
  border-left: var(--oc-border-width) solid var(--oc-border-muted);
}
.project-icon-registry-workbench__change-markers {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
  margin-right: var(--oc-space-2);
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
