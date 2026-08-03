<template>
  <div class="project-icon-series-editor">
    <OcText v-if="error" tone="danger" size="sm">{{ error }}</OcText>
    <OcText v-if="draftSeries.length === 0" tone="muted" size="sm">
      {{ t('projectConfig.icons.empty') }}
    </OcText>

    <ProjectConfigSection v-for="(series, seriesIndex) in draftSeries" :key="seriesIndex"
      class="project-icon-series-editor__series" :section-id="`project-icon-series-${seriesIndex}`"
      :heading="series.key"
      :collapsed="expandedSeriesIndex !== seriesIndex"
      :expand-label="t('projectConfig.sections.expand', { section: series.key })"
      :collapse-label="t('projectConfig.sections.collapse', { section: series.key })"
      section-indent="single" content-indent="single" @toggle="toggleSeries(seriesIndex)">
      <template #heading-actions>
          <OcText as="span" tone="muted" size="sm">
            {{ t('projectConfig.icons.iconCount', { count: series.icons.length }) }}
          </OcText>
      </template>
      <template #actions>
        <span class="project-icon-series-editor__series-actions">
          <OcButton icon-only size="sm" icon="action.add" variant="ghost"
            :disabled="!runtimeSeries(series.key)"
            :aria-label="t('projectConfig.icons.generateIcons')" :data-tooltip="t('projectConfig.icons.generateIcons')"
            @click="openGridDialog(seriesIndex)" />
          <OcButton icon-only size="sm" icon="tool.settings" variant="ghost"
            :aria-label="t('projectConfig.icons.configureIconSet')"
            :data-tooltip="t('projectConfig.icons.configureIconSet')"
            @click="openSettingsDialog(seriesIndex)" />
          <OcButton icon-only size="sm" icon="action.delete" icon-tone="danger" variant="ghost"
            :aria-label="t('projectConfig.icons.removeSeries')" :data-tooltip="t('projectConfig.icons.removeSeries')"
            @click="removeSeries(seriesIndex)" />
        </span>
      </template>
      <div class="project-icon-series-editor__series-body">
        <OcText v-if="seriesLoadError(series.key)" tone="danger" size="sm">
          {{ t('projectConfig.icons.imageLoadFailed') }}
        </OcText>
        <div class="project-icon-series-editor__visual-editor">
          <ProjectIconCropEditor :runtime="runtimeSeries(series.key)"
            :icon="selectedIcon(seriesIndex)" :alt="series.key"
            :snap-to-grid="gridSettings(series).snapToGrid"
            :grid-rows="gridSettings(series).rows" :grid-columns="gridSettings(series).columns"
            :pixelated="gridSettings(series).pixelated"
            :pixelated-label="t('projectConfig.icons.pixelated')"
            :grid-label="t('projectConfig.icons.showGrid')"
            :move-label="t('projectConfig.icons.moveCrop')" :handle-labels="cropHandleLabels"
            @update:icon="updateSelectedIcon(seriesIndex, $event)"
            @update:pixelated="updateGridSettings(seriesIndex, { pixelated: $event })" />
          <OcOverlayToolbar class="project-icon-series-editor__grid-toolbar"
            :label="t('projectConfig.icons.gridSettings')">
            <OcButton icon-only size="sm" icon="tool.snap-grid"
              :active="gridSettings(series).snapToGrid"
              :aria-pressed="gridSettings(series).snapToGrid"
              :variant="gridSettings(series).snapToGrid ? 'soft' : 'ghost'"
              :aria-label="t('projectConfig.icons.snapToGrid')"
              :data-tooltip="t('projectConfig.icons.snapToGrid')"
              @click="toggleGridSnapping(seriesIndex)" />
            <OcFieldFrame class="project-icon-series-editor__grid-field" size="sm">
              <template #prefix><OcIcon name="layout.rows" size="sm" tone="muted" /></template>
              <OcFieldInput variant="plain" size="sm" type="number" min="1" step="1"
                :value="gridSettings(series).rows" :aria-label="t('projectConfig.icons.rows')"
                @change="updateGridDimension(seriesIndex, 'rows', $event)" />
            </OcFieldFrame>
            <OcFieldFrame class="project-icon-series-editor__grid-field" size="sm">
              <template #prefix><OcIcon name="layout.columns" size="sm" tone="muted" /></template>
              <OcFieldInput variant="plain" size="sm" type="number" min="1" step="1"
                :value="gridSettings(series).columns" :aria-label="t('projectConfig.icons.columns')"
                @change="updateGridDimension(seriesIndex, 'columns', $event)" />
            </OcFieldFrame>
          </OcOverlayToolbar>
        </div>
        <div class="project-icon-series-editor__inspector">
          <aside class="project-icon-series-editor__tree-pane">
            <OcTree :data="iconTreeData(seriesIndex)" :actions="iconTreeActions"
              :selected-keys="selectedTreeKeys(seriesIndex)" selection-mode="single"
              role="listbox" fill scroll-to-selection @intent="handleTreeIntent(seriesIndex, $event)" />
          </aside>
          <div class="project-icon-series-editor__property-pane">
            <PropertyEditor :ref="component => setPropertyEditorRef(seriesIndex, component)"
              :inputs="iconPropertyInputs(seriesIndex)" :categories="iconPropertyCategories"
              sort-mode="category" @update-property="updateIconProperty(seriesIndex, $event)" />
          </div>
        </div>
      </div>
    </ProjectConfigSection>

    <ProjectIconSetSettingsDialog :open="settingsSeriesIndex !== null"
      :name="settingsSeries?.key" :source="settingsSeries?.source"
      :existing-names="draftSeries.map(series => series.key)"
      @close="closeSettingsDialog" @submit="saveIconSetSettings" />
    <ProjectIconGridDialog :open="gridDialogSeriesIndex !== null"
      :has-icons="Boolean(gridDialogSeries?.icons.length)"
      :initial-rows="gridDialogSeries ? gridSettings(gridDialogSeries).rows : 1"
      :initial-columns="gridDialogSeries ? gridSettings(gridDialogSeries).columns : 1"
      :initial-pixelated="gridDialogSeries ? gridSettings(gridDialogSeries).pixelated : false"
      @close="closeGridDialog" @submit="generateIcons" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DEFAULT_PROJECT_ICON_GRID_SETTINGS,
  findProjectIconKeyConflicts,
  generateProjectIconGrid,
  moveProjectIcon,
  type ProjectIcon,
  type ProjectIconGridSettings,
  type ProjectIconKeyConflict,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import {
  buildProjectIconCatalog,
  createProjectIconStyle,
  findProjectIconSeries,
  type ProjectIconCatalog,
  type ProjectIconCatalogEntry,
} from '../../features/workspace/services/projectIconCatalog'
import type { OcTreeIntent, OcTreeData, OcTreeActionDefinition } from '../../shared/ui/tree/tree.types'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../../shared/ui/property-editor/propertyEditor.types'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcTree from '../standard/OcTree.vue'
import OcButton from '../base/OcButton.vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import ProjectIconCropEditor, { type ProjectIconCropHandle } from './ProjectIconCropEditor.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import ProjectIconGridDialog, { type ProjectIconGridRequest } from './ProjectIconGridDialog.vue'
import ProjectIconSetSettingsDialog, {
  type ProjectIconSetSettingsRequest,
} from './ProjectIconSetSettingsDialog.vue'

const props = defineProps<{
  series: readonly ProjectIconSeries[] | undefined
  resolveAssetSrc: (source: string) => string
  error?: string
}>()
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries[]]
  'key-conflicts': [conflicts: readonly ProjectIconKeyConflict[]]
}>()
const { t } = useI18n()
const draftSeries = ref<ProjectIconSeries[]>([])
const catalog = ref<ProjectIconCatalog>({ series: [], entries: [], errors: [] })
const expandedSeriesIndex = ref<number | null>(null)
const selectedIconIndexes = ref<Record<number, number>>({})
const settingsSeriesIndex = ref<number | null>(null)
const gridDialogSeriesIndex = ref<number | null>(null)
const propertyEditorRefs = new Map<number, InstanceType<typeof PropertyEditor>>()
let catalogVersion = 0
let initialized = false
let lastKeySignature: string | null = null

const settingsSeries = computed(() => settingsSeriesIndex.value === null
  ? null
  : draftSeries.value[settingsSeriesIndex.value] ?? null)
const gridDialogSeries = computed(() => gridDialogSeriesIndex.value === null
  ? null
  : draftSeries.value[gridDialogSeriesIndex.value] ?? null)

const iconPropertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
  ['identity', { title: t('projectConfig.icons.identity'), icon: 'data.symbol-class' }],
  ['crop', { title: t('projectConfig.icons.crop'), icon: 'tool.box-cutter' }],
  ['appearance', { title: t('projectConfig.icons.appearance'), icon: 'file.image' }],
]))
const iconTreeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['more', { title: t('projectConfig.icons.iconActions'), icon: 'nav.more', children: ['move-up', 'move-down', 'delete'] }],
  ['move-up', { title: t('propertyEditor.arrays.moveUp'), icon: 'nav.arrow-up' }],
  ['move-down', { title: t('propertyEditor.arrays.moveDown'), icon: 'nav.arrow-down' }],
  ['delete', { title: t('projectConfig.icons.removeIcon'), icon: 'action.delete', iconTone: 'danger' }],
]))
const cropHandleLabels = computed<Record<ProjectIconCropHandle, string>>(() => Object.fromEntries(
  (['lt', 't', 'rt', 'r', 'rb', 'b', 'lb', 'l'] as const).map(handle => [
    handle,
    t('projectConfig.icons.resizeCrop', { handle: t(`projectConfig.icons.handles.${handle}`) }),
  ]),
) as Record<ProjectIconCropHandle, string>)
watch(() => props.series, value => {
  const previousLength = draftSeries.value.length
  draftSeries.value = (value ?? []).map(series => ({ ...series, icons: series.icons.map(icon => ({ ...icon })) }))
  if (!initialized) {
    expandedSeriesIndex.value = draftSeries.value.length > 0 ? 0 : null
    initialized = true
  } else if (draftSeries.value.length > previousLength) expandedSeriesIndex.value = draftSeries.value.length - 1
  else if (expandedSeriesIndex.value === null && draftSeries.value.length > 0) expandedSeriesIndex.value = 0
  else if (expandedSeriesIndex.value !== null && expandedSeriesIndex.value >= draftSeries.value.length) {
    expandedSeriesIndex.value = draftSeries.value.length > 0 ? draftSeries.value.length - 1 : null
  }
  for (const [index, series] of draftSeries.value.entries()) {
    selectedIconIndexes.value[index] = Math.min(selectedIconIndexes.value[index] ?? 0, Math.max(0, series.icons.length - 1))
  }
  refreshKeyConflicts()
}, { immediate: true })

watch(() => draftSeries.value.map(series => `${series.key}\u0000${series.source}`).join('\u0001'), async () => {
  const version = ++catalogVersion
  const next = await buildProjectIconCatalog(draftSeries.value, props.resolveAssetSrc)
  if (version === catalogVersion) catalog.value = next
}, { immediate: true })

function runtimeSeries(key: string) { return findProjectIconSeries(catalog.value, key) }
function gridSettings(series: ProjectIconSeries): Readonly<ProjectIconGridSettings> {
  return series.grid ?? DEFAULT_PROJECT_ICON_GRID_SETTINGS
}
function updateGridSettings(seriesIndex: number, patch: Partial<ProjectIconGridSettings>): void {
  const series = draftSeries.value[seriesIndex]
  if (!series) return
  draftSeries.value[seriesIndex] = {
    ...series,
    grid: { ...gridSettings(series), ...patch },
  }
  commit()
}
function toggleGridSnapping(seriesIndex: number): void {
  const series = draftSeries.value[seriesIndex]
  if (series) updateGridSettings(seriesIndex, { snapToGrid: !gridSettings(series).snapToGrid })
}
function updateGridDimension(
  seriesIndex: number,
  field: 'rows' | 'columns',
  event: Event,
): void {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number(event.target.value)
  if (Number.isInteger(value) && value > 0) updateGridSettings(seriesIndex, { [field]: value })
}
function selectedIcon(index: number): ProjectIcon | null {
  return draftSeries.value[index]?.icons[selectedIconIndexes.value[index] ?? 0] ?? null
}
function catalogEntry(seriesIndex: number, iconIndex: number): ProjectIconCatalogEntry | null {
  const series = draftSeries.value[seriesIndex]
  const icon = series?.icons[iconIndex]
  const runtime = series ? runtimeSeries(series.key) : null
  if (!series || !icon || !runtime || icon.x + icon.width > runtime.imageWidth
    || icon.y + icon.height > runtime.imageHeight) return null
  return {
    ...icon,
    seriesKey: series.key,
    source: runtime.source,
    src: runtime.src,
    imageWidth: runtime.imageWidth,
    imageHeight: runtime.imageHeight,
  }
}
function seriesLoadError(key: string): boolean {
  return catalog.value.errors.some(error => error.seriesKey.toLocaleLowerCase() === key.toLocaleLowerCase()
    && error.reason === 'load-failed')
}
function commit(): void {
  emit('update:series', draftSeries.value.map(series => ({
    ...series,
    icons: series.icons.map(icon => ({ ...icon })),
  })))
}
function refreshKeyConflicts(): void {
  const signature = JSON.stringify(draftSeries.value.map(series => [
    series.key,
    series.icons.map(icon => icon.iconKey),
  ]))
  if (signature === lastKeySignature) return
  lastKeySignature = signature
  emit('key-conflicts', findProjectIconKeyConflicts(draftSeries.value))
}
function toggleSeries(seriesIndex: number): void {
  expandedSeriesIndex.value = expandedSeriesIndex.value === seriesIndex ? null : seriesIndex
}
function openSettingsDialog(seriesIndex: number): void {
  expandedSeriesIndex.value = seriesIndex
  settingsSeriesIndex.value = seriesIndex
}
function closeSettingsDialog(): void {
  settingsSeriesIndex.value = null
}
function saveIconSetSettings(request: ProjectIconSetSettingsRequest): void {
  const index = settingsSeriesIndex.value
  const series = index === null ? null : draftSeries.value[index]
  if (index === null || !series) return
  draftSeries.value[index] = { ...series, key: request.key }
  refreshKeyConflicts()
  settingsSeriesIndex.value = null
  commit()
}
function openGridDialog(seriesIndex: number): void {
  expandedSeriesIndex.value = seriesIndex
  gridDialogSeriesIndex.value = seriesIndex
}
function closeGridDialog(): void {
  gridDialogSeriesIndex.value = null
}
function generateIcons(request: ProjectIconGridRequest): void {
  const seriesIndex = gridDialogSeriesIndex.value
  if (seriesIndex === null) return
  const series = draftSeries.value[seriesIndex]
  const runtime = series ? runtimeSeries(series.key) : null
  if (!series || !runtime) return
  const mode = request.overwrite ? 'replace' : 'append'
  const generated = generateProjectIconGrid({
    series,
    imageWidth: runtime.imageWidth,
    imageHeight: runtime.imageHeight,
    rows: request.rows,
    columns: request.columns,
    mode,
    pixelated: request.pixelated,
    createName: ({ index }) => t('projectConfig.icons.defaultIconName', { index }),
  })
  if (!generated) return
  draftSeries.value[seriesIndex] = {
    ...generated,
    grid: {
      ...gridSettings(series),
      rows: request.rows,
      columns: request.columns,
      pixelated: request.pixelated,
    },
  }
  selectedIconIndexes.value[seriesIndex] = mode === 'append' ? series.icons.length : 0
  refreshKeyConflicts()
  gridDialogSeriesIndex.value = null
  commit()
}
function iconTreeData(seriesIndex: number): OcTreeData {
  const series = draftSeries.value[seriesIndex]
  const rootKeys = (series?.icons ?? []).map((_, index) => `icon:${index}`)
  return {
    rootKeys,
    items: new Map(rootKeys.map((key, index) => {
      const icon = series!.icons[index]!
      const entry = catalogEntry(seriesIndex, index)
      return [key, {
        label: icon.name,
        ...(entry ? { thumbnailStyle: createProjectIconStyle(entry), thumbnailLabel: icon.name } : { icon: 'file.image' as const }),
        draggable: true,
        actions: ['more'],
        contextActions: ['move-up', 'move-down', 'delete'],
      }]
    })),
    children: new Map(),
  }
}
function selectedTreeKeys(seriesIndex: number): string[] {
  return draftSeries.value[seriesIndex]?.icons.length
    ? [`icon:${selectedIconIndexes.value[seriesIndex] ?? 0}`]
    : []
}
function treeIndex(key: string | null): number | null {
  if (!key?.startsWith('icon:')) return null
  const index = Number(key.slice('icon:'.length))
  return Number.isInteger(index) ? index : null
}
function handleTreeIntent(seriesIndex: number, intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    const index = treeIndex(intent.selectedKeys[0] ?? null)
    if (index !== null) selectedIconIndexes.value[seriesIndex] = index
  } else if (intent.type === 'move.request') {
    const fromIndex = treeIndex(intent.key)
    const targetIndex = treeIndex(intent.targetKey)
    if (fromIndex === null || targetIndex === null) return
    let toIndex = targetIndex + (intent.position === 'after' ? 1 : 0)
    if (fromIndex < toIndex) toIndex -= 1
    moveIcon(seriesIndex, fromIndex, toIndex)
  } else if (intent.type === 'action.invoke') {
    const index = treeIndex(intent.key)
    if (index === null) return
    if (intent.actionKey === 'delete') removeIcon(seriesIndex, index)
    else if (intent.actionKey === 'move-up') moveIcon(seriesIndex, index, index - 1)
    else if (intent.actionKey === 'move-down') moveIcon(seriesIndex, index, index + 1)
  }
}
function iconPropertyInputs(seriesIndex: number): PropertyEditorInput[] {
  const icon = selectedIcon(seriesIndex)
  if (!icon) return []
  return [{
    key: `icon:${seriesIndex}:${selectedIconIndexes.value[seriesIndex] ?? 0}`,
    title: icon.name,
    record: {
      iconKey: icon.iconKey,
      name: icon.name,
      x: String(icon.x), y: String(icon.y), width: String(icon.width), height: String(icon.height),
      pixelated: String(icon.pixelated ?? false),
    },
    fields: {
      iconKey: { title: t('projectConfig.icons.referenceName'), fieldType: 'string', category: 'identity', order: 1, required: true, commitMode: 'blur' },
      name: { title: t('projectConfig.icons.iconName'), fieldType: 'string', category: 'identity', order: 2, commitMode: 'blur' },
      x: { title: 'X', fieldType: 'number', category: 'crop', order: 1, min: 0 },
      y: { title: 'Y', fieldType: 'number', category: 'crop', order: 2, min: 0 },
      width: { title: t('projectConfig.icons.width'), fieldType: 'number', category: 'crop', order: 3, min: 1 },
      height: { title: t('projectConfig.icons.height'), fieldType: 'number', category: 'crop', order: 4, min: 1 },
      pixelated: { title: t('projectConfig.icons.pixelated'), fieldType: 'boolean', category: 'appearance', order: 1 },
    },
  }]
}
function updateIconProperty(seriesIndex: number, mutation: PropertyEditorMutation): void {
  const index = selectedIconIndexes.value[seriesIndex] ?? 0
  if (mutation.fieldKey === 'iconKey' || mutation.fieldKey === 'name') {
    updateIcon(seriesIndex, index, { [mutation.fieldKey]: String(mutation.value) })
    return
  }
  if (mutation.fieldKey === 'pixelated') {
    updateIcon(seriesIndex, index, { pixelated: mutation.value === true || mutation.value === 'true' })
    return
  }
  if (['x', 'y', 'width', 'height'].includes(mutation.fieldKey)) {
    updateIcon(seriesIndex, index, { [mutation.fieldKey]: Number(mutation.value) })
  }
}
function updateSelectedIcon(seriesIndex: number, icon: ProjectIcon): void {
  updateIcon(seriesIndex, selectedIconIndexes.value[seriesIndex] ?? 0, icon)
}
function updateIcon(seriesIndex: number, iconIndex: number, patch: Partial<ProjectIcon>): void {
  const series = draftSeries.value[seriesIndex]
  const icon = series?.icons[iconIndex]
  if (!series || !icon) return
  const icons = [...series.icons]
  icons[iconIndex] = { ...icon, ...patch }
  draftSeries.value[seriesIndex] = { ...series, icons }
  if (patch.iconKey !== undefined) refreshKeyConflicts()
  commit()
}
function removeIcon(seriesIndex: number, iconIndex: number): void {
  const series = draftSeries.value[seriesIndex]
  if (!series) return
  draftSeries.value[seriesIndex] = { ...series, icons: series.icons.filter((_, index) => index !== iconIndex) }
  selectedIconIndexes.value[seriesIndex] = Math.min(
    selectedIconIndexes.value[seriesIndex] ?? 0,
    Math.max(0, draftSeries.value[seriesIndex]!.icons.length - 1),
  )
  refreshKeyConflicts()
  commit()
}
function removeSeries(index: number): void {
  draftSeries.value.splice(index, 1)
  expandedSeriesIndex.value = draftSeries.value.length > 0 ? Math.min(index, draftSeries.value.length - 1) : null
  settingsSeriesIndex.value = null
  gridDialogSeriesIndex.value = null
  refreshKeyConflicts()
  commit()
}
function moveIcon(seriesIndex: number, fromIndex: number, toIndex: number): void {
  const series = draftSeries.value[seriesIndex]
  if (!series || toIndex < 0 || toIndex >= series.icons.length || fromIndex === toIndex) return
  const selected = selectedIconIndexes.value[seriesIndex] ?? 0
  draftSeries.value[seriesIndex] = moveProjectIcon(series, fromIndex, toIndex)
  if (selected === fromIndex) selectedIconIndexes.value[seriesIndex] = toIndex
  else if (fromIndex < selected && toIndex >= selected) selectedIconIndexes.value[seriesIndex] = selected - 1
  else if (fromIndex > selected && toIndex <= selected) selectedIconIndexes.value[seriesIndex] = selected + 1
  refreshKeyConflicts()
  commit()
}

function setPropertyEditorRef(seriesIndex: number, component: unknown): void {
  const editor = component as InstanceType<typeof PropertyEditor> | null
  if (editor) propertyEditorRefs.set(seriesIndex, editor)
  else propertyEditorRefs.delete(seriesIndex)
}

async function navigateToKeyConflict(conflict: ProjectIconKeyConflict): Promise<boolean> {
  const series = draftSeries.value[conflict.seriesIndex]
  if (!series) return false
  expandedSeriesIndex.value = conflict.seriesIndex
  if (conflict.kind === 'series') {
    openSettingsDialog(conflict.seriesIndex)
    return true
  }
  if (!series.icons[conflict.iconIndex]) return false
  selectedIconIndexes.value[conflict.seriesIndex] = conflict.iconIndex
  await nextTick()
  await propertyEditorRefs.get(conflict.seriesIndex)?.activateField(
    `icon:${conflict.seriesIndex}:${conflict.iconIndex}`,
    'iconKey',
  )
  return true
}

defineExpose({ navigateToKeyConflict })
</script>

<style scoped>
.project-icon-series-editor,
.project-icon-series-editor__series-body,
.project-icon-series-editor__property-pane {
  display: grid;
  gap: var(--oc-space-3);
}

.project-icon-series-editor__series:last-child {
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
}

.project-icon-series-editor__series-actions { display: inline-flex; align-items: center; gap: var(--oc-space-1); }

.project-icon-series-editor__visual-editor {
  position: relative;
  min-width: 0;
}

.project-icon-series-editor__grid-toolbar {
  position: absolute;
  right: var(--oc-space-2);
  bottom: var(--oc-space-2);
  z-index: var(--oc-z-overlay-toolbar);
}

.project-icon-series-editor__grid-field {
  min-width: var(--oc-overlay-toolbar-field-min-width);
  max-width: var(--oc-overlay-toolbar-field-max-width);
}

.project-icon-series-editor__inspector {
  display: grid;
  grid-template-columns:
    minmax(var(--oc-project-icon-tree-min-width), var(--oc-project-icon-tree-max-width))
    minmax(var(--oc-project-icon-property-min-width), 1fr);
  min-height: var(--oc-project-icon-inspector-min-height);
  height: var(--oc-project-icon-inspector-height);
  max-height: var(--oc-project-icon-inspector-max-height);
  align-items: stretch;
  gap: var(--oc-space-4);
  overflow: hidden;
}

.project-icon-series-editor__tree-pane,
.project-icon-series-editor__property-pane {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.project-icon-series-editor__tree-pane {
  border-inline-end: var(--oc-border-width) solid var(--oc-border-muted);
}

</style>
