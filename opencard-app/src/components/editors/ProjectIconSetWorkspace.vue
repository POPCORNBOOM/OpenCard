<template>
  <div class="project-icon-set-workspace">
    <section class="project-icon-set-workspace__canvas-pane">
      <OcText v-if="loadError" class="project-icon-set-workspace__load-error" tone="danger" size="sm">
        {{ t('projectConfig.icons.imageLoadFailed') }}
      </OcText>
      <div class="project-icon-set-workspace__visual-editor">
        <ProjectIconCropEditor fill :runtime="runtime" :icon="selectedIcon" :alt="series.key"
          :snap-to-grid="gridSettings.snapToGrid" :grid-rows="gridSettings.rows"
          :grid-columns="gridSettings.columns" :pixelated="gridSettings.pixelated"
          :pixelated-label="t('projectConfig.icons.pixelated')"
          :grid-label="t('projectConfig.icons.showGrid')"
          :move-label="t('projectConfig.icons.moveCrop')" :handle-labels="cropHandleLabels"
          @update:icon="updateSelectedIcon" @update:pixelated="updateGridSettings({ pixelated: $event })" />
        <OcOverlayToolbar class="project-icon-set-workspace__series-toolbar"
          :label="t('projectConfig.icons.iconSet')">
          <div class="project-icon-set-workspace__series-identity">
            <strong>{{ series.key }}</strong>
            <OcText as="code" tone="muted" size="xs">{{ series.source }}</OcText>
          </div>
          <OcButton icon-only size="sm" icon="tool.settings" variant="ghost"
            :aria-label="t('projectConfig.icons.configureIconSet')"
            :data-tooltip="t('projectConfig.icons.configureIconSet')" @click="emit('configure')" />
        </OcOverlayToolbar>
        <OcOverlayToolbar class="project-icon-set-workspace__grid-toolbar"
          :label="t('projectConfig.icons.gridSettings')">
          <OcButton icon-only size="sm" icon="tool.snap-grid"
            :active="gridSettings.snapToGrid" :aria-pressed="gridSettings.snapToGrid"
            :variant="gridSettings.snapToGrid ? 'soft' : 'ghost'"
            :aria-label="t('projectConfig.icons.snapToGrid')"
            :data-tooltip="t('projectConfig.icons.snapToGrid')" @click="toggleGridSnapping" />
          <OcFieldFrame class="project-icon-set-workspace__grid-field" size="sm">
            <template #prefix><OcIcon name="layout.rows" size="sm" tone="muted" /></template>
            <OcFieldInput variant="plain" size="sm" type="number" min="1" step="1"
              :value="gridSettings.rows" :aria-label="t('projectConfig.icons.rows')"
              @change="updateGridDimension('rows', $event)" />
          </OcFieldFrame>
          <OcFieldFrame class="project-icon-set-workspace__grid-field" size="sm">
            <template #prefix><OcIcon name="layout.columns" size="sm" tone="muted" /></template>
            <OcFieldInput variant="plain" size="sm" type="number" min="1" step="1"
              :value="gridSettings.columns" :aria-label="t('projectConfig.icons.columns')"
              @change="updateGridDimension('columns', $event)" />
          </OcFieldFrame>
        </OcOverlayToolbar>
      </div>
    </section>

    <aside class="project-icon-set-workspace__inspector">
      <OcCard class="project-icon-set-workspace__icon-list" fill variant="glass"
        :title="t('projectConfig.icons.iconList')" :actions="iconListActions" @action="handleIconListAction">
        <OcPanel fill tone="transparent" border="none" padding="none" overflow="auto" align="stretch">
          <OcTree v-if="series.icons.length" class="project-icon-set-workspace__icon-tree" fill scroll-to-selection
            role="listbox" :data="iconTreeData" :actions="iconTreeActions" :selected-keys="selectedTreeKeys"
            selection-mode="single" @intent="handleTreeIntent" />
          <OcEmpty v-else class="project-icon-set-workspace__empty" tone="muted">
            {{ t('projectConfig.icons.emptyIconList') }}
          </OcEmpty>
        </OcPanel>
      </OcCard>

      <OcCard class="project-icon-set-workspace__properties" fill variant="glass"
        :title="t('projectConfig.icons.properties')">
        <OcPanel fill tone="transparent" border="none" padding="none" overflow="auto" align="stretch">
          <PropertyEditor v-if="selectedIcon" ref="propertyEditorRef" :inputs="iconPropertyInputs"
            :categories="iconPropertyCategories" sort-mode="category" @update-property="updateIconProperty" />
          <OcEmpty v-else class="project-icon-set-workspace__empty" tone="muted">
            {{ t('projectConfig.icons.noIconSelected') }}
          </OcEmpty>
        </OcPanel>
      </OcCard>
    </aside>

    <ProjectIconGridDialog :open="gridDialogOpen" :has-icons="Boolean(series.icons.length)"
      :initial-rows="gridSettings.rows" :initial-columns="gridSettings.columns"
      :initial-pixelated="gridSettings.pixelated" @close="gridDialogOpen = false" @submit="generateIcons" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DEFAULT_PROJECT_ICON_GRID_SETTINGS,
  generateProjectIconGrid,
  moveProjectIcon,
  type ProjectIcon,
  type ProjectIconGridSettings,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import {
  createProjectIconStyle,
  type ProjectIconCatalogEntry,
  type ProjectIconSeriesRuntime,
} from '../../features/workspace/services/projectIconCatalog'
import type { OcTreeActionDefinition, OcTreeData, OcTreeIntent } from '../../shared/ui/tree/tree.types'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../../shared/ui/property-editor/propertyEditor.types'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcPanel from '../base/OcPanel.vue'
import OcText from '../base/OcText.vue'
import OcCard, { type OcCardAction } from '../standard/OcCard.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectIconCropEditor, { type ProjectIconCropHandle } from './ProjectIconCropEditor.vue'
import ProjectIconGridDialog, { type ProjectIconGridRequest } from './ProjectIconGridDialog.vue'

const props = defineProps<{
  series: ProjectIconSeries
  runtime: ProjectIconSeriesRuntime | null
  loadError?: boolean
  selectedIconIndex: number | null
}>()
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries]
  'update:selectedIconIndex': [index: number | null]
  configure: []
}>()
const { t } = useI18n()
const propertyEditorRef = ref<InstanceType<typeof PropertyEditor> | null>(null)
const gridDialogOpen = ref(false)

const selectedIcon = computed(() => props.selectedIconIndex === null
  ? null
  : props.series.icons[props.selectedIconIndex] ?? null)
const gridSettings = computed<Readonly<ProjectIconGridSettings>>(() => (
  props.series.grid ?? DEFAULT_PROJECT_ICON_GRID_SETTINGS
))
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
const iconListActions = computed<OcCardAction[]>(() => [{
  key: 'generate',
  title: t('projectConfig.icons.generateIcons'),
  icon: 'tool.grid',
  disabled: !props.runtime,
}])
const cropHandleLabels = computed<Record<ProjectIconCropHandle, string>>(() => Object.fromEntries(
  (['lt', 't', 'rt', 'r', 'rb', 'b', 'lb', 'l'] as const).map(handle => [
    handle,
    t('projectConfig.icons.resizeCrop', { handle: t(`projectConfig.icons.handles.${handle}`) }),
  ]),
) as Record<ProjectIconCropHandle, string>)

function catalogEntry(iconIndex: number): ProjectIconCatalogEntry | null {
  const icon = props.series.icons[iconIndex]
  const runtime = props.runtime
  if (!icon || !runtime || icon.x + icon.width > runtime.imageWidth
    || icon.y + icon.height > runtime.imageHeight) return null
  return {
    ...icon,
    seriesKey: props.series.key,
    source: runtime.source,
    src: runtime.src,
    imageWidth: runtime.imageWidth,
    imageHeight: runtime.imageHeight,
  }
}

const iconTreeData = computed<OcTreeData>(() => {
  const rootKeys = props.series.icons.map((_, index) => `icon:${index}`)
  return {
    rootKeys,
    items: new Map(rootKeys.map((key, index) => {
      const icon = props.series.icons[index]!
      const entry = catalogEntry(index)
      return [key, {
        label: icon.name,
        ...(entry
          ? { thumbnailStyle: createProjectIconStyle(entry), thumbnailLabel: icon.name }
          : { icon: 'file.image' as const }),
        draggable: true,
        actions: ['more'],
        contextActions: ['move-up', 'move-down', 'delete'],
      }]
    })),
    children: new Map(),
  }
})
const selectedTreeKeys = computed(() => props.selectedIconIndex === null
  ? []
  : [`icon:${props.selectedIconIndex}`])
const iconPropertyInputs = computed<PropertyEditorInput[]>(() => {
  const icon = selectedIcon.value
  if (!icon || props.selectedIconIndex === null) return []
  return [{
    key: `icon:${props.selectedIconIndex}`,
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
})

function commit(next: ProjectIconSeries): void {
  emit('update:series', next)
}

function updateGridSettings(patch: Partial<ProjectIconGridSettings>): void {
  commit({ ...props.series, grid: { ...gridSettings.value, ...patch } })
}

function toggleGridSnapping(): void {
  updateGridSettings({ snapToGrid: !gridSettings.value.snapToGrid })
}

function handleIconListAction(payload: { key: string }): void {
  if (payload.key === 'generate' && props.runtime) gridDialogOpen.value = true
}

function updateGridDimension(field: 'rows' | 'columns', event: Event): void {
  if (!(event.target instanceof HTMLInputElement)) return
  const value = Number(event.target.value)
  if (Number.isInteger(value) && value > 0) updateGridSettings({ [field]: value })
}

function treeIndex(key: string | null): number | null {
  if (!key?.startsWith('icon:')) return null
  const index = Number(key.slice('icon:'.length))
  return Number.isInteger(index) ? index : null
}

function handleTreeIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    emit('update:selectedIconIndex', treeIndex(intent.selectedKeys[0] ?? null))
    return
  }
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
  if (intent.actionKey === 'delete') removeIcon(index)
  else if (intent.actionKey === 'move-up') moveIcon(index, index - 1)
  else if (intent.actionKey === 'move-down') moveIcon(index, index + 1)
}

function updateSelectedIcon(icon: ProjectIcon): void {
  if (props.selectedIconIndex !== null) updateIcon(props.selectedIconIndex, icon)
}

function updateIcon(index: number, patch: Partial<ProjectIcon>): void {
  const icon = props.series.icons[index]
  if (!icon) return
  const icons = [...props.series.icons]
  icons[index] = { ...icon, ...patch }
  commit({ ...props.series, icons })
}

function updateIconProperty(mutation: PropertyEditorMutation): void {
  const index = props.selectedIconIndex
  if (index === null) return
  if (mutation.fieldKey === 'iconKey' || mutation.fieldKey === 'name') {
    updateIcon(index, { [mutation.fieldKey]: String(mutation.value) })
  } else if (mutation.fieldKey === 'pixelated') {
    updateIcon(index, { pixelated: mutation.value === true || mutation.value === 'true' })
  } else if (['x', 'y', 'width', 'height'].includes(mutation.fieldKey)) {
    updateIcon(index, { [mutation.fieldKey]: Number(mutation.value) })
  }
}

function removeIcon(index: number): void {
  const icons = props.series.icons.filter((_, iconIndex) => iconIndex !== index)
  const selected = props.selectedIconIndex
  commit({ ...props.series, icons })
  if (selected === null) return
  if (selected === index) emit('update:selectedIconIndex', icons.length ? Math.min(index, icons.length - 1) : null)
  else if (selected > index) emit('update:selectedIconIndex', selected - 1)
}

function moveIcon(fromIndex: number, toIndex: number): void {
  if (toIndex < 0 || toIndex >= props.series.icons.length || fromIndex === toIndex) return
  const selected = props.selectedIconIndex
  commit(moveProjectIcon(props.series, fromIndex, toIndex))
  if (selected === fromIndex) emit('update:selectedIconIndex', toIndex)
  else if (selected !== null && fromIndex < selected && toIndex >= selected) emit('update:selectedIconIndex', selected - 1)
  else if (selected !== null && fromIndex > selected && toIndex <= selected) emit('update:selectedIconIndex', selected + 1)
}

function generateIcons(request: ProjectIconGridRequest): void {
  const runtime = props.runtime
  if (!runtime) return
  const mode = request.overwrite ? 'replace' : 'append'
  const generated = generateProjectIconGrid({
    series: props.series,
    imageWidth: runtime.imageWidth,
    imageHeight: runtime.imageHeight,
    rows: request.rows,
    columns: request.columns,
    mode,
    pixelated: request.pixelated,
    createName: ({ index }) => t('projectConfig.icons.defaultIconName', { index }),
  })
  if (!generated) return
  commit({
    ...generated,
    grid: {
      ...gridSettings.value,
      rows: request.rows,
      columns: request.columns,
      pixelated: request.pixelated,
    },
  })
  emit('update:selectedIconIndex', generated.icons.length
    ? (mode === 'append' ? props.series.icons.length : 0)
    : null)
  gridDialogOpen.value = false
}

async function activateIconKey(iconIndex: number): Promise<boolean> {
  if (!props.series.icons[iconIndex]) return false
  emit('update:selectedIconIndex', iconIndex)
  await nextTick()
  await propertyEditorRef.value?.activateField(`icon:${iconIndex}`, 'iconKey')
  return true
}

defineExpose({ activateIconKey })
</script>

<style scoped>
.project-icon-set-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(var(--oc-project-icon-property-min-width), var(--oc-project-icon-workbench-inspector-width));
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--oc-bg-inset);
}

.project-icon-set-workspace__canvas-pane,
.project-icon-set-workspace__icon-list,
.project-icon-set-workspace__properties,
.project-icon-set-workspace__inspector {
  min-width: 0;
  min-height: 0;
}

.project-icon-set-workspace__canvas-pane {
  position: relative;
  overflow: hidden;
}

.project-icon-set-workspace__load-error {
  position: absolute;
  top: var(--oc-space-2);
  left: 50%;
  z-index: var(--oc-z-overlay-toolbar);
  transform: translateX(-50%);
}

.project-icon-set-workspace__visual-editor {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.project-icon-set-workspace__series-toolbar {
  position: absolute;
  top: var(--oc-space-2);
  left: var(--oc-space-2);
  z-index: var(--oc-z-overlay-toolbar);
}

.project-icon-set-workspace__series-identity {
  display: grid;
  min-width: 0;
  gap: var(--oc-space-1);
}

.project-icon-set-workspace__series-identity code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-icon-set-workspace__grid-toolbar {
  position: absolute;
  right: var(--oc-space-2);
  bottom: var(--oc-space-2);
  z-index: var(--oc-z-overlay-toolbar);
}

.project-icon-set-workspace__grid-field {
  min-width: var(--oc-overlay-toolbar-field-min-width);
  max-width: var(--oc-overlay-toolbar-field-max-width);
}

.project-icon-set-workspace__inspector {
  display: grid;
  grid-template-rows: minmax(0, var(--oc-project-icon-workbench-icon-list-height)) minmax(0, 1fr);
  gap: var(--oc-space-2);
  padding: var(--oc-space-2);
  overflow: hidden;
}

.project-icon-set-workspace__icon-list,
.project-icon-set-workspace__properties {
  overflow: hidden;
}

.project-icon-set-workspace__icon-tree,
.project-icon-set-workspace__properties :deep(.property-editor) {
  min-height: 0;
  overflow: auto;
}

.project-icon-set-workspace__empty {
  align-self: center;
}

@media (max-width: 1040px) {
  .project-icon-set-workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows:
      minmax(var(--oc-project-icon-atlas-height), 1fr)
      minmax(var(--oc-project-icon-workbench-icon-list-height), 1fr);
  }

  .project-icon-set-workspace__canvas-pane {
    min-height: 0;
  }

  .project-icon-set-workspace__inspector {
    grid-template-columns: minmax(0, 1fr) minmax(var(--oc-project-icon-property-min-width), 1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .project-icon-set-workspace__icon-list {
    min-height: 0;
  }
}
</style>
