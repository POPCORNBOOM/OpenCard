<template>
  <div class="project-icon-set-workspace" :class="{ 'is-empty': displayIcons.length === 0 }">
    <div v-if="displayIcons.length === 0" class="project-icon-set-workspace__empty">
      <OcIcon name="tool.box-cutter" size="lg" tone="muted" />
      <OcText as="strong">{{ t('projectConfig.icons.noCropRecords') }}</OcText>
      <OcText class="project-icon-set-workspace__empty-hint" tone="muted" size="sm">
        <span>{{ t('projectConfig.icons.createCropHintStart') }}</span>
        <OcIcon name="action.image-plus" size="sm" />
        <span>{{ t('projectConfig.icons.createCropHintOr') }}</span>
        <OcIcon name="tool.grid" size="sm" />
        <span>{{ t('projectConfig.icons.createCropHintEnd') }}</span>
      </OcText>
    </div>
    <template v-else>
    <div class="project-icon-set-workspace__tree-pane">
      <OcFieldFrame class="project-icon-set-workspace__filter" full-width>
        <template #prefix><OcIcon name="action.search" size="sm" tone="muted" /></template>
        <OcFieldInput variant="plain" full-width :value="filterQuery"
          :placeholder="t('projectConfig.icons.filterPlaceholder')"
          :aria-label="t('projectConfig.icons.filterPlaceholder')" @input="updateFilter" />
        <template v-if="filterQuery" #suffix>
          <OcButton icon-only size="sm" icon="action.close" variant="ghost"
            :aria-label="t('projectConfig.icons.clearFilter')"
            :data-tooltip="t('projectConfig.icons.clearFilter')" @click="filterQuery = ''" />
        </template>
      </OcFieldFrame>
      <div class="project-icon-set-workspace__tree-scroll">
        <OcTree v-if="filteredIconIndexes.length" class="project-icon-set-workspace__icon-tree" fill
          virtualized scroll-to-selection role="listbox" :data="iconTreeData" :actions="iconTreeActions"
          :action-overflow-title="t('projectConfig.icons.iconActions')"
          :selected-keys="selectedTreeKeys" selection-mode="multiple" @intent="handleTreeIntent" />
        <OcEmpty v-else tone="muted">
          {{ displayIcons.length ? t('projectConfig.icons.noMatchingIcons') : t('projectConfig.icons.emptyIconList') }}
        </OcEmpty>
      </div>
    </div>
    <div class="project-icon-set-workspace__property-pane">
      <PropertyEditor v-if="propertyInputs.length || comparisonPropertyInputs.length" ref="propertyEditorRef"
        :inputs="propertyInputs"
        :categories="iconPropertyCategories" sort-mode="category"
        :comparison-inputs="comparison ? comparisonPropertyInputs : readOnly ? propertyInputs : undefined"
        @update-property="updateIconProperty" />
      <OcEmpty v-else tone="muted">{{ t('projectConfig.icons.noIconSelected') }}</OcEmpty>
    </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  duplicateProjectIcon,
  DEFAULT_PROJECT_ICON_GRID_SETTINGS,
  moveProjectIcon,
  PROJECT_ICON_ROTATIONS,
  type ProjectIcon,
  type ProjectIconRotation,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import {
  createProjectIconStyle,
  type ProjectIconCatalogEntry,
  type ProjectIconSeriesRuntime,
} from '../../features/workspace/services/projectIconCatalog'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../../shared/ui/property-editor/propertyEditor.types'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import { orderedPair } from '../../shared/model/orderedPair'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'
import OcTree from '../standard/OcTree.vue'

const props = defineProps<{
  series: ProjectIconSeries
  runtime: ProjectIconSeriesRuntime | null
  comparisonSeries?: ProjectIconSeries
  comparisonRuntime?: ProjectIconSeriesRuntime | null
  comparison?: boolean
  currentMissing?: boolean
  selectedIconIndexes: readonly number[]
  readOnly?: boolean
}>()
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries]
  'update:selectedIconIndexes': [indexes: number[]]
}>()
const { t } = useI18n()
const propertyEditorRef = ref<InstanceType<typeof PropertyEditor> | null>(null)
const filterQuery = ref('')

const displayIcons = computed<readonly ProjectIcon[]>(() => {
  const current = [...props.series.icons]
  if (!props.comparison) return current
  return orderedPair(props.comparisonSeries?.icons ?? [], current,
    icon => icon.iconKey.toLocaleLowerCase())
    .flatMap(pair => pair.rightItem ? [pair.rightItem] : pair.leftItem ? [pair.leftItem] : [])
})
const selectedIconIndexes = computed(() => props.selectedIconIndexes.filter(index => (
  Number.isInteger(index) && index >= 0 && index < displayIcons.value.length
)))
const selectedIconIndex = computed(() => selectedIconIndexes.value[0] ?? null)
const selectedIconKey = computed(() => selectedIconIndex.value === null
  ? null : displayIcons.value[selectedIconIndex.value]?.iconKey ?? null)
function findIcon(series: ProjectIconSeries | undefined, key: string | null): ProjectIcon | null {
  if (!series || key === null) return null
  return series.icons.find(icon => icon.iconKey.toLocaleLowerCase() === key.toLocaleLowerCase()) ?? null
}
const selectedIcon = computed(() => findIcon(props.series, selectedIconKey.value))
const comparisonIcon = computed(() => findIcon(props.comparisonSeries, selectedIconKey.value))
const iconPropertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
  ['identity', { title: t('projectConfig.icons.identity'), icon: 'data.symbol-class' }],
  ['source', { title: t('projectConfig.icons.file'), icon: 'file.image' }],
  ['grid', { title: t('projectConfig.icons.gridSettings'), icon: 'tool.grid' }],
  ['crop', { title: t('projectConfig.icons.crop'), icon: 'tool.box-cutter' }],
  ['appearance', { title: t('projectConfig.icons.appearance'), icon: 'file.image' }],
]))
const iconTreeActions = computed<ReadonlyMap<string, OcTreeActionDefinition>>(() => new Map([
  ['duplicate', { title: t('projectConfig.icons.duplicateIcon'), icon: 'action.copy' }],
  ['move-top', { title: t('projectConfig.icons.moveToTop'), icon: 'format.vertical-top' }],
  ['move-up', { title: t('propertyEditor.arrays.moveUp'), icon: 'nav.arrow-up' }],
  ['move-down', { title: t('propertyEditor.arrays.moveDown'), icon: 'nav.arrow-down' }],
  ['move-bottom', { title: t('projectConfig.icons.moveToBottom'), icon: 'format.vertical-bottom' }],
  ['delete', { title: t('projectConfig.icons.removeIcon'), icon: 'action.delete', iconTone: 'danger' }],
]))

function catalogEntry(icon: ProjectIcon, series: ProjectIconSeries, runtime: ProjectIconSeriesRuntime | null): ProjectIconCatalogEntry | null {
  if (!icon || !runtime || icon.x + icon.width > runtime.imageWidth
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

const filteredIconIndexes = computed(() => {
  const query = filterQuery.value.trim().toLocaleLowerCase()
  if (!query) return displayIcons.value.map((_, index) => index)
  return displayIcons.value.flatMap((icon, index) => (
    icon.name.toLocaleLowerCase().includes(query) || icon.iconKey.toLocaleLowerCase().includes(query)
      ? [index]
      : []
  ))
})
const iconTreeData = computed<OcTreeData>(() => {
  const rootKeys = filteredIconIndexes.value.map(index => `icon:${index}`)
  return {
    rootKeys,
    items: new Map(filteredIconIndexes.value.map(index => {
      const key = `icon:${index}`
      const icon = displayIcons.value[index]!
      const current = findIcon(props.series, icon.iconKey)
      const historical = findIcon(props.comparisonSeries, icon.iconKey)
      const entry = current && props.runtime
        ? catalogEntry(current, props.series, props.runtime)
        : historical && props.comparisonSeries && props.comparisonRuntime
          ? catalogEntry(historical, props.comparisonSeries, props.comparisonRuntime)
          : null
      return [key, {
        label: icon.name,
        ...(entry
          ? { thumbnailStyle: createProjectIconStyle(entry), thumbnailLabel: icon.name }
          : { icon: 'file.image' as const }),
        changeMarkers: props.comparison && JSON.stringify(current) !== JSON.stringify(historical)
          ? [
              ...(historical ? [{ icon: 'status.change-removed' as const, tone: 'danger' as const }] : []),
              ...(current ? [{ icon: 'status.change-added' as const, tone: 'success' as const }] : []),
            ]
          : undefined,
        draggable: !props.readOnly,
        actions: props.readOnly ? [] : ['duplicate', 'move-top', 'move-up', 'move-down', 'move-bottom', 'delete'],
        contextActions: props.readOnly ? [] : ['duplicate', 'move-top', 'move-up', 'move-down', 'move-bottom', 'delete'],
        disabledActions: new Map([
          ...(index === 0 ? [
            ['move-top', t('projectConfig.icons.alreadyAtTop')],
            ['move-up', t('projectConfig.icons.alreadyAtTop')],
          ] as const : []),
          ...(index === displayIcons.value.length - 1 ? [
            ['move-down', t('projectConfig.icons.alreadyAtBottom')],
            ['move-bottom', t('projectConfig.icons.alreadyAtBottom')],
          ] as const : []),
        ]),
      }]
    })),
    children: new Map(),
  }
})
const selectedTreeKeys = computed(() => selectedIconIndexes.value.map(index => `icon:${index}`))
function createSeriesPropertyInput(series: ProjectIconSeries | undefined, key: string | null): PropertyEditorInput[] {
  if (!series || key === null) return []
  const grid = series.grid ?? DEFAULT_PROJECT_ICON_GRID_SETTINGS
  return [{
    key: `series:${key.toLocaleLowerCase()}`,
    title: series.name,
    record: {
      name: series.name,
      key: series.key,
      source: series.source,
      snapToGrid: String(grid.snapToGrid),
      rows: String(grid.rows),
      columns: String(grid.columns),
      pixelated: String(grid.pixelated),
    },
    fields: {
      name: { title: t('projectConfig.icons.iconSetName'), fieldType: 'string', category: 'identity', order: 1 },
      key: { title: t('projectConfig.icons.referenceName'), fieldType: 'string', category: 'identity', order: 2 },
      source: { title: t('projectConfig.icons.file'), fieldType: 'string', category: 'source', order: 1 },
      snapToGrid: { title: t('projectConfig.icons.snapToGrid'), fieldType: 'boolean', category: 'grid', order: 1 },
      rows: { title: t('projectConfig.icons.rows'), fieldType: 'number', category: 'grid', order: 2 },
      columns: { title: t('projectConfig.icons.columns'), fieldType: 'number', category: 'grid', order: 3 },
      pixelated: { title: t('projectConfig.icons.pixelated'), fieldType: 'boolean', category: 'grid', order: 4 },
    },
  }]
}
function createIconPropertyInputs(icon: ProjectIcon | null, identity: string | null,
  includeAtlasRotation = false): PropertyEditorInput[] {
  if (!icon || identity === null) return []
  return [{
    key: `icon:${identity.toLocaleLowerCase()}`,
    title: icon.name,
    record: {
      iconKey: icon.iconKey,
      name: icon.name,
      x: String(icon.x),
      y: String(icon.y),
      width: String(icon.width),
      height: String(icon.height),
      pixelated: String(icon.pixelated ?? false),
      rotation: `${icon.rotation ?? 0}°`,
      ...(includeAtlasRotation ? { atlasRotation: `${icon.atlasRotation ?? 0}°` } : {}),
    },
    fields: {
      iconKey: { title: t('projectConfig.icons.referenceName'), fieldType: 'string', category: 'identity', order: 1, required: true, commitMode: 'blur' },
      name: { title: t('projectConfig.icons.iconName'), fieldType: 'string', category: 'identity', order: 2, commitMode: 'blur' },
      x: { title: 'X', fieldType: 'number', category: 'crop', order: 1, min: 0 },
      y: { title: 'Y', fieldType: 'number', category: 'crop', order: 2, min: 0 },
      width: { title: t('projectConfig.icons.width'), fieldType: 'number', category: 'crop', order: 3, min: 1 },
      height: { title: t('projectConfig.icons.height'), fieldType: 'number', category: 'crop', order: 4, min: 1 },
      pixelated: { title: t('projectConfig.icons.pixelated'), fieldType: 'boolean', category: 'appearance', order: 1 },
      rotation: {
        title: t('projectConfig.icons.rotation'), fieldType: 'string', category: 'appearance', order: 2,
        options: PROJECT_ICON_ROTATIONS.map(value => `${value}°`), enumMode: 'select',
      },
      ...(includeAtlasRotation ? {
        atlasRotation: {
          title: t('projectConfig.icons.atlasRotation'), fieldType: 'string', category: 'appearance', order: 3,
          options: PROJECT_ICON_ROTATIONS.map(value => `${value}°`), enumMode: 'select' as const,
        },
      } : {}),
    },
  }]
}
const propertyInputs = computed(() => [
  ...(props.comparison ? createSeriesPropertyInput(props.currentMissing ? undefined : props.series, props.series.key) : []),
  ...createIconPropertyInputs(selectedIcon.value, selectedIconKey.value, props.comparison),
])
const comparisonPropertyInputs = computed(() => [
  ...createSeriesPropertyInput(props.comparisonSeries, props.series.key),
  ...createIconPropertyInputs(comparisonIcon.value, selectedIconKey.value, true),
])

function treeIndex(key: string | null): number | null {
  if (!key?.startsWith('icon:')) return null
  const index = Number(key.slice('icon:'.length))
  return Number.isInteger(index) ? index : null
}

function updateFilter(event: Event): void {
  if (event.target instanceof HTMLInputElement) filterQuery.value = event.target.value
}

function handleTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    emit('update:selectedIconIndexes', intent.selectedKeys
      .map(key => treeIndex(key))
      .filter((index): index is number => index !== null))
    return
  }
  if (props.readOnly) return
  if (intent.type === 'move.request') {
    const fromIndex = treeIndex(intent.key)
    const targetIndex = treeIndex(intent.targetKey)
    if (fromIndex === null || targetIndex === null) return
    let toIndex = targetIndex + (intent.position === 'after' ? 1 : 0)
    if (fromIndex < toIndex) toIndex -= 1
    moveIcon(fromIndex, toIndex)
    return
  }
  if (intent.type !== 'action.invoke') return
  const index = treeIndex(intent.key)
  if (index === null) return
  const indexes = intent.source === 'context' && ['delete', 'move-top', 'move-up', 'move-down', 'move-bottom'].includes(intent.actionKey)
    ? selectedIconIndexes.value
    : selectedIconIndex.value === null ? [index] : [selectedIconIndex.value]
  if (intent.actionKey === 'duplicate') duplicateIcon(indexes[0] ?? index)
  else if (intent.actionKey === 'delete') removeIcons(indexes)
  else if (intent.actionKey === 'move-top') moveIcons(indexes, 'top')
  else if (intent.actionKey === 'move-up') moveIcons(indexes, 'up')
  else if (intent.actionKey === 'move-down') moveIcons(indexes, 'down')
  else if (intent.actionKey === 'move-bottom') moveIcons(indexes, 'bottom')
}

function moveIcon(fromIndex: number, toIndex: number): void {
  if (toIndex < 0 || toIndex >= props.series.icons.length || fromIndex === toIndex) return
  emit('update:series', moveProjectIcon(props.series, fromIndex, toIndex))
  const nextSelected = selectedIconIndexes.value.map(index => {
    if (index === fromIndex) return toIndex
    if (fromIndex < toIndex && index > fromIndex && index <= toIndex) return index - 1
    if (fromIndex > toIndex && index >= toIndex && index < fromIndex) return index + 1
    return index
  }).sort((a, b) => a - b)
  if (nextSelected.some((index, position) => index !== selectedIconIndexes.value[position])) {
    emit('update:selectedIconIndexes', nextSelected)
  }
}

function updateIcon(index: number, patch: Partial<ProjectIcon>): void {
  if (props.readOnly) return
  const icon = props.series.icons[index]
  if (!icon) return
  const icons = [...props.series.icons]
  icons[index] = { ...icon, ...patch }
  emit('update:series', { ...props.series, icons })
}

function updateIconProperty(mutation: PropertyEditorMutation): void {
  const index = selectedIconIndex.value
  if (index === null) return
  if (mutation.fieldKey === 'iconKey' || mutation.fieldKey === 'name') {
    updateIcon(index, { [mutation.fieldKey]: String(mutation.value) })
  } else if (mutation.fieldKey === 'pixelated') {
    updateIcon(index, { pixelated: mutation.value === true || mutation.value === 'true' })
  } else if (mutation.fieldKey === 'rotation' || mutation.fieldKey === 'atlasRotation') {
    const value = Number(String(mutation.value).replace('°', ''))
    if ((PROJECT_ICON_ROTATIONS as readonly number[]).includes(value)) {
      updateIcon(index, { [mutation.fieldKey]: value as ProjectIconRotation })
    }
  } else if (['x', 'y', 'width', 'height'].includes(mutation.fieldKey)) {
    updateIcon(index, { [mutation.fieldKey]: Number(mutation.value) })
  }
}

function removeIcons(indexes: readonly number[]): void {
  const selected = [...new Set(indexes)].filter(index => index >= 0 && index < props.series.icons.length).sort((a, b) => a - b)
  if (selected.length === 0) return
  const selectedSet = new Set(selected)
  const icons = props.series.icons.filter((_, index) => !selectedSet.has(index))
  emit('update:selectedIconIndexes', icons.length ? [Math.min(selected[0]!, icons.length - 1)] : [])
  emit('update:series', { ...props.series, icons })
}

function duplicateIcon(index: number): void {
  const duplicated = duplicateProjectIcon(props.series, index)
  if (duplicated === props.series) return
  emit('update:series', duplicated)
  emit('update:selectedIconIndexes', [index + 1])
}

function moveIcons(indexes: readonly number[], direction: 'top' | 'up' | 'down' | 'bottom'): void {
  const selected = [...new Set(indexes)].filter(index => index >= 0 && index < props.series.icons.length).sort((a, b) => a - b)
  if (selected.length === 0) return
  const selectedSet = new Set(selected)
  const icons = [...props.series.icons]
  const nextIndexes = new Set(selected)

  if (direction === 'top' || direction === 'bottom') {
    const selectedIcons = selected.map(index => icons[index]!)
    const remainingIcons = icons.filter((_, index) => !selectedSet.has(index))
    const nextIcons = direction === 'top'
      ? [...selectedIcons, ...remainingIcons]
      : [...remainingIcons, ...selectedIcons]
    const start = direction === 'top' ? 0 : remainingIcons.length
    emit('update:selectedIconIndexes', selected.map((_, index) => start + index))
    emit('update:series', { ...props.series, icons: nextIcons })
    return
  }

  if (direction === 'up') {
    for (let index = 1; index < icons.length; index += 1) {
      if (!selectedSet.has(index) || selectedSet.has(index - 1)) continue
      ;[icons[index - 1], icons[index]] = [icons[index]!, icons[index - 1]!]
      nextIndexes.delete(index)
      nextIndexes.add(index - 1)
      selectedSet.delete(index)
      selectedSet.add(index - 1)
    }
  } else {
    for (let index = icons.length - 2; index >= 0; index -= 1) {
      if (!selectedSet.has(index) || selectedSet.has(index + 1)) continue
      ;[icons[index], icons[index + 1]] = [icons[index + 1]!, icons[index]!]
      nextIndexes.delete(index)
      nextIndexes.add(index + 1)
      selectedSet.delete(index)
      selectedSet.add(index + 1)
    }
  }

  const nextSelected = [...nextIndexes].sort((a, b) => a - b)
  if (nextSelected.every((index, position) => index === selected[position])) return
  emit('update:selectedIconIndexes', nextSelected)
  emit('update:series', { ...props.series, icons })
}

async function activateIconKey(iconIndex: number): Promise<boolean> {
  if (!props.series.icons[iconIndex]) return false
  emit('update:selectedIconIndexes', [iconIndex])
  await nextTick()
  await propertyEditorRef.value?.activateField(`icon:${iconIndex}`, 'iconKey')
  return true
}

defineExpose({ activateIconKey })
</script>

<style scoped>
.project-icon-set-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(var(--oc-project-icon-property-min-width), 1fr);
  min-width: 0;
  min-height: var(--oc-project-icon-inspector-min-height);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
}

.project-icon-set-workspace.is-empty { border-style: dashed; }

.project-icon-set-workspace__empty {
  display: grid;
  grid-column: 1 / -1;
  min-width: 0;
  min-height: var(--oc-project-icon-inspector-min-height);
  place-content: center;
  justify-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-4);
  text-align: center;
}

.project-icon-set-workspace__empty-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--oc-space-1);
}

.project-icon-set-workspace__tree-pane,
.project-icon-set-workspace__property-pane {
  min-width: 0;
  min-height: 0;
}

.project-icon-set-workspace__tree-pane {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  border-right: var(--oc-border-width) solid var(--oc-border-muted);
}

.project-icon-set-workspace__filter {
  margin: var(--oc-space-2);
  width: auto;
}

.project-icon-set-workspace__tree-scroll {
  position: relative;
  min-height: 0;
  overflow: hidden;
}

.project-icon-set-workspace__icon-tree {
  position: absolute;
  inset: 0;
}

.project-icon-set-workspace__icon-tree :deep(.oc-tree__node) {
  content-visibility: auto;
  contain-intrinsic-block-size: var(--oc-size-md);
}
</style>
