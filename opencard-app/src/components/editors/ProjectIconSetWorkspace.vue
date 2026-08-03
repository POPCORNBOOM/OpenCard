<template>
  <div class="project-icon-set-workspace">
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
          :selected-keys="selectedTreeKeys" selection-mode="single" @intent="handleTreeIntent" />
        <OcEmpty v-else tone="muted">
          {{ series.icons.length ? t('projectConfig.icons.noMatchingIcons') : t('projectConfig.icons.emptyIconList') }}
        </OcEmpty>
      </div>
    </div>
    <div class="project-icon-set-workspace__property-pane">
      <PropertyEditor v-if="selectedIcon" ref="propertyEditorRef" :inputs="iconPropertyInputs"
        :categories="iconPropertyCategories" sort-mode="category" @update-property="updateIconProperty" />
      <OcEmpty v-else tone="muted">{{ t('projectConfig.icons.noIconSelected') }}</OcEmpty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { moveProjectIcon, type ProjectIcon, type ProjectIconSeries } from '../../features/workspace/model/projectIcons'
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
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcButton from '../base/OcButton.vue'
import OcEmpty from '../base/OcEmpty.vue'
import OcFieldFrame from '../base/OcFieldFrame.vue'
import OcFieldInput from '../base/OcFieldInput.vue'
import OcIcon from '../base/OcIcon.vue'
import OcTree from '../standard/OcTree.vue'

const props = defineProps<{
  series: ProjectIconSeries
  runtime: ProjectIconSeriesRuntime | null
  selectedIconIndex: number | null
}>()
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries]
  'update:selectedIconIndex': [index: number | null]
}>()
const { t } = useI18n()
const propertyEditorRef = ref<InstanceType<typeof PropertyEditor> | null>(null)
const filterQuery = ref('')

const selectedIcon = computed(() => props.selectedIconIndex === null
  ? null
  : props.series.icons[props.selectedIconIndex] ?? null)
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

function catalogEntry(index: number): ProjectIconCatalogEntry | null {
  const icon = props.series.icons[index]
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

const filteredIconIndexes = computed(() => {
  const query = filterQuery.value.trim().toLocaleLowerCase()
  if (!query) return props.series.icons.map((_, index) => index)
  return props.series.icons.flatMap((icon, index) => (
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
      x: String(icon.x),
      y: String(icon.y),
      width: String(icon.width),
      height: String(icon.height),
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

function updateIcon(index: number, patch: Partial<ProjectIcon>): void {
  const icon = props.series.icons[index]
  if (!icon) return
  const icons = [...props.series.icons]
  icons[index] = { ...icon, ...patch }
  emit('update:series', { ...props.series, icons })
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
  emit('update:series', { ...props.series, icons })
  if (selected === null) return
  if (selected === index) emit('update:selectedIconIndex', icons.length ? Math.min(index, icons.length - 1) : null)
  else if (selected > index) emit('update:selectedIconIndex', selected - 1)
}

function moveIcon(fromIndex: number, toIndex: number): void {
  if (toIndex < 0 || toIndex >= props.series.icons.length || fromIndex === toIndex) return
  const selected = props.selectedIconIndex
  emit('update:series', moveProjectIcon(props.series, fromIndex, toIndex))
  if (selected === fromIndex) emit('update:selectedIconIndex', toIndex)
  else if (selected !== null && fromIndex < selected && toIndex >= selected) emit('update:selectedIconIndex', selected - 1)
  else if (selected !== null && fromIndex > selected && toIndex <= selected) emit('update:selectedIconIndex', selected + 1)
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
  grid-template-columns: minmax(0, 1fr) minmax(var(--oc-project-icon-property-min-width), 1fr);
  min-width: 0;
  min-height: var(--oc-project-icon-inspector-min-height);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
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
