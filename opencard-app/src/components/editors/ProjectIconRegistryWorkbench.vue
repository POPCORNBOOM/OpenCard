<template>
  <div class="project-icon-registry-workbench">
    <aside class="project-icon-registry-workbench__series-pane">
      <OcCard fill variant="glass" icon="file.image" :title="t('projectConfig.icons.iconSets')"
        :actions="seriesCardActions" @action="handleSeriesCardAction">
        <OcPanel fill tone="transparent" border="none" padding="none" overflow="auto" align="stretch">
          <OcText v-if="error" class="project-icon-registry-workbench__error" tone="danger" size="sm">
            {{ error }}
          </OcText>
          <OcTree v-if="series.length" class="project-icon-registry-workbench__series-tree" fill
            role="listbox" :data="seriesTreeData" :actions="seriesTreeActions"
            :selected-keys="selectedSeriesTreeKeys" selection-mode="single" @intent="handleSeriesTreeIntent" />
          <OcEmpty v-else class="project-icon-registry-workbench__empty" tone="muted">
            {{ t('projectConfig.icons.empty') }}
          </OcEmpty>
        </OcPanel>
      </OcCard>
    </aside>

    <ProjectIconSetWorkspace v-if="selectedSeries && selectedSeriesIndex !== null"
      ref="setWorkspaceRef" :series="selectedSeries" :runtime="selectedRuntime"
      :load-error="selectedSeriesLoadError" :selected-icon-index="selectedIconIndex"
      @update:series="updateSelectedSeries" @update:selected-icon-index="setSelectedIconIndex"
      @configure="openSettingsDialog(selectedSeriesIndex)" />

    <div v-else class="project-icon-registry-workbench__placeholder">
      <OcIcon name="file.image" size="lg" tone="muted" />
      <OcEmpty tone="muted" inset="none">{{ t('projectConfig.icons.noSeriesSelected') }}</OcEmpty>
    </div>

    <ProjectIconSetSettingsDialog :open="settingsSeriesIndex !== null"
      :name="settingsSeries?.key" :source="settingsSeries?.source"
      :existing-names="series.map(candidate => candidate.key)"
      @close="closeSettingsDialog" @submit="saveIconSetSettings" />
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
import {
  buildProjectIconCatalog,
  findProjectIconSeries,
  type ProjectIconCatalog,
} from '../../features/workspace/services/projectIconCatalog'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import OcEmpty from '../base/OcEmpty.vue'
import OcIcon from '../base/OcIcon.vue'
import OcPanel from '../base/OcPanel.vue'
import OcText from '../base/OcText.vue'
import OcCard, { type OcCardAction } from '../standard/OcCard.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectIconSetSettingsDialog, {
  type ProjectIconSetSettingsRequest,
} from './ProjectIconSetSettingsDialog.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

const props = withDefaults(defineProps<{
  series?: readonly ProjectIconSeries[]
  resolveAssetSrc: (source: string) => string
  projectIconCatalog?: ProjectIconCatalog
  error?: string
}>(), {
  series: () => [],
  error: '',
})
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries[]]
  'key-conflicts': [conflicts: readonly ProjectIconKeyConflict[]]
  register: []
}>()
const { t } = useI18n()
const selectedSeriesKey = ref<string | null>(null)
const selectedIconIndexes = ref<Record<string, number | null>>({})
const settingsSeriesIndex = ref<number | null>(null)
const setWorkspaceRef = ref<InstanceType<typeof ProjectIconSetWorkspace> | null>(null)
const localCatalog = ref<ProjectIconCatalog>({ series: [], entries: [], errors: [] })
let catalogVersion = 0

const selectedSeriesIndex = computed(() => {
  if (selectedSeriesKey.value === null) return null
  const index = props.series.findIndex(candidate => candidate.key === selectedSeriesKey.value)
  return index >= 0 ? index : null
})
const selectedSeries = computed(() => selectedSeriesIndex.value === null
  ? null
  : props.series[selectedSeriesIndex.value] ?? null)
const selectedRuntime = computed(() => selectedSeries.value
  ? findProjectIconSeries(localCatalog.value, selectedSeries.value.key)
    ?? findProjectIconSeries(props.projectIconCatalog, selectedSeries.value.key)
  : null)
const selectedSeriesLoadError = computed(() => selectedSeries.value
  ? [...localCatalog.value.errors, ...(props.projectIconCatalog?.errors ?? [])].some(error => (
      error.seriesKey.toLocaleLowerCase() === selectedSeries.value!.key.toLocaleLowerCase()
      && error.reason === 'load-failed'
    ))
  : false)
const selectedIconIndex = computed(() => {
  const current = selectedSeries.value
  if (!current) return null
  const index = selectedIconIndexes.value[current.key]
  return index !== null && index !== undefined && current.icons[index] ? index : null
})
const settingsSeries = computed(() => settingsSeriesIndex.value === null
  ? null
  : props.series[settingsSeriesIndex.value] ?? null)
const conflicts = computed(() => findProjectIconKeyConflicts(props.series))

const seriesTreeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['more', {
    title: t('projectConfig.icons.iconSetActions'),
    icon: 'nav.more',
    children: ['configure', 'delete'],
  }],
  ['configure', { title: t('projectConfig.icons.configureIconSet'), icon: 'tool.settings' }],
  ['delete', { title: t('projectConfig.icons.removeSeries'), icon: 'action.delete', iconTone: 'danger' }],
]))
const seriesCardActions = computed<OcCardAction[]>(() => [{
  key: 'register',
  title: t('projectConfig.icons.register'),
  icon: 'action.add',
}])
const seriesTreeData = computed<OcTreeData>(() => {
  const rootKeys = props.series.map((_, index) => `series:${index}`)
  const conflictedIndexes = new Set(conflicts.value
    .filter(conflict => conflict.kind === 'series')
    .map(conflict => conflict.seriesIndex))
  return {
    rootKeys,
    items: new Map(rootKeys.map((key, index) => {
      const candidate = props.series[index]!
      const hasLoadError = [...localCatalog.value.errors, ...(props.projectIconCatalog?.errors ?? [])].some(error => (
        error.seriesKey.toLocaleLowerCase() === candidate.key.toLocaleLowerCase()
      ))
      return [key, {
        label: candidate.key,
        icon: 'file.image' as const,
        ...(hasLoadError || conflictedIndexes.has(index) ? { iconTone: 'danger' as const } : {}),
        actions: ['more'],
        contextActions: ['configure', 'delete'],
      }]
    })),
    children: new Map(),
  }
})
const selectedSeriesTreeKeys = computed(() => selectedSeriesIndex.value === null
  ? []
  : [`series:${selectedSeriesIndex.value}`])

watch(() => props.series, (nextSeries) => {
  if (selectedSeriesKey.value !== null
    && !nextSeries.some(candidate => candidate.key === selectedSeriesKey.value)) {
    selectedSeriesKey.value = null
  }
  const nextSelections: Record<string, number | null> = {}
  for (const candidate of nextSeries) {
    const selected = selectedIconIndexes.value[candidate.key]
    nextSelections[candidate.key] = selected !== null && selected !== undefined && candidate.icons[selected]
      ? selected
      : null
  }
  selectedIconIndexes.value = nextSelections
}, { immediate: true })

watch(() => selectedSeries.value
  ? `${selectedSeries.value.key}\u0000${selectedSeries.value.source}`
  : null, async identity => {
  const version = ++catalogVersion
  if (identity === null || !selectedSeries.value) {
    localCatalog.value = { series: [], entries: [], errors: [] }
    return
  }
  const next = await buildProjectIconCatalog([selectedSeries.value], props.resolveAssetSrc)
  if (version === catalogVersion) localCatalog.value = next
}, { immediate: true })

watch(conflicts, value => emit('key-conflicts', value), { immediate: true })

function seriesIndexFromTreeKey(key: string | null): number | null {
  if (!key?.startsWith('series:')) return null
  const index = Number(key.slice('series:'.length))
  return Number.isInteger(index) && props.series[index] ? index : null
}

function selectSeriesByIndex(index: number): void {
  const candidate = props.series[index]
  if (!candidate) return
  selectedSeriesKey.value = candidate.key
  if (selectedIconIndexes.value[candidate.key] === null && candidate.icons.length) {
    selectedIconIndexes.value[candidate.key] = 0
  }
}

function handleSeriesTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    const index = seriesIndexFromTreeKey(intent.selectedKeys[0] ?? null)
    if (index !== null) selectSeriesByIndex(index)
    return
  }
  if (intent.type !== 'action.invoke') return
  const index = seriesIndexFromTreeKey(intent.key)
  if (index === null) return
  if (intent.actionKey === 'configure') openSettingsDialog(index)
  else if (intent.actionKey === 'delete') removeSeries(index)
}

function handleSeriesCardAction(payload: { key: string }): void {
  if (payload.key === 'register') emit('register')
}

function updateSelectedSeries(nextSeries: ProjectIconSeries): void {
  const index = selectedSeriesIndex.value
  if (index === null) return
  const next = [...props.series]
  next[index] = nextSeries
  if (selectedSeriesKey.value !== nextSeries.key) {
    const previousKey = selectedSeriesKey.value
    selectedSeriesKey.value = nextSeries.key
    if (previousKey !== null) {
      selectedIconIndexes.value[nextSeries.key] = selectedIconIndexes.value[previousKey] ?? null
      delete selectedIconIndexes.value[previousKey]
    }
  }
  emit('update:series', next)
}

function setSelectedIconIndex(index: number | null): void {
  const key = selectedSeriesKey.value
  if (key !== null) selectedIconIndexes.value[key] = index
}

function openSettingsDialog(index: number): void {
  if (props.series[index]) settingsSeriesIndex.value = index
}

function closeSettingsDialog(): void {
  settingsSeriesIndex.value = null
}

function saveIconSetSettings(request: ProjectIconSetSettingsRequest): void {
  const index = settingsSeriesIndex.value
  const current = index === null ? null : props.series[index]
  if (index === null || !current) return
  const next = [...props.series]
  next[index] = { ...current, key: request.key }
  if (selectedSeriesKey.value === current.key) {
    selectedSeriesKey.value = request.key
    selectedIconIndexes.value[request.key] = selectedIconIndexes.value[current.key] ?? null
    delete selectedIconIndexes.value[current.key]
  }
  settingsSeriesIndex.value = null
  emit('update:series', next)
}

function removeSeries(index: number): void {
  const removed = props.series[index]
  if (!removed) return
  emit('update:series', props.series.filter((_, candidateIndex) => candidateIndex !== index))
  delete selectedIconIndexes.value[removed.key]
  if (selectedSeriesKey.value === removed.key) selectedSeriesKey.value = null
  settingsSeriesIndex.value = null
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
  setSelectedIconIndex(conflict.iconIndex)
  await nextTick()
  return await setWorkspaceRef.value?.activateIconKey(conflict.iconIndex) ?? false
}

defineExpose({ selectSeries, navigateToKeyConflict })
</script>

<style scoped>
.project-icon-registry-workbench {
  display: grid;
  grid-template-columns: minmax(0, var(--oc-project-icon-workbench-series-width)) minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--oc-bg-base);
}

.project-icon-registry-workbench__series-pane {
  min-width: 0;
  min-height: 0;
  padding: var(--oc-space-2);
  overflow: hidden;
}

.project-icon-registry-workbench__error {
  padding: var(--oc-space-2) var(--oc-space-3);
}

.project-icon-registry-workbench__series-tree {
  min-height: 0;
  overflow: auto;
}

.project-icon-registry-workbench__empty {
  align-self: center;
}

.project-icon-registry-workbench__placeholder {
  display: grid;
  place-content: center;
  justify-items: center;
  min-width: 0;
  min-height: 0;
  gap: var(--oc-space-3);
  background: var(--oc-bg-inset);
}
</style>
