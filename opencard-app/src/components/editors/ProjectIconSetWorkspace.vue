<template>
  <div class="project-icon-set-workspace" :class="{ 'is-empty': series.icons.length === 0 }">
    <div v-if="series.icons.length === 0" class="project-icon-set-workspace__empty">
      <OcIcon name="file.image" size="lg" tone="muted" />
      <OcText as="strong">{{ t('projectConfig.icons.emptyIconList') }}</OcText>
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
          virtualized scroll-to-selection role="listbox" :data="iconTreeData"
          :action-overflow-title="t('projectConfig.icons.iconActions')"
          :selected-keys="selectedTreeKeys" selection-mode="multiple"
          @selection-change="handleSelectionChange" @action="handleNodeAction" @move="handleNodeMove" />
        <OcEmpty v-else tone="muted">{{ t('projectConfig.icons.noMatchingIcons') }}</OcEmpty>
      </div>
    </div>
    <div class="project-icon-set-workspace__property-pane">
      <PropertyEditor v-if="selectedIcon" ref="propertyEditorRef" :inputs="iconPropertyInputs"
        :categories="iconPropertyCategories" sort-mode="category" @update-property="updateIconProperty" />
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
  moveProjectIcon,
  PROJECT_ICON_ROTATIONS,
  PROJECT_ICON_TINTS,
  type ProjectIcon,
  type ProjectIconRotation,
  type ProjectIconSeries,
} from '../../features/workspace/model/projectIcons'
import {
  createProjectIconStyle,
  projectIconIdentity,
  type ProjectIconCatalogEntry,
} from '../../features/workspace/services/projectIconCatalog'
import { readProjectIconSize } from '../../features/workspace/services/projectIconDimensionResolver'
import type {
  PropertyEditorCategoryDefinition,
  PropertyEditorInput,
  PropertyEditorMutation,
} from '../../shared/ui/property-editor/propertyEditor.types'
import type {
  OcNode,
  OcNodeAction,
  OcNodeActionEvent,
  OcNodeCollection,
  OcNodeContextEntry,
  OcNodeMoveEvent,
  OcNodeSelectionEvent,
} from '../../shared/ui/node/node.types'
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
  entries: readonly ProjectIconCatalogEntry[]
  selectedIconIndexes: readonly number[]
}>()
const emit = defineEmits<{
  'update:series': [series: ProjectIconSeries]
  'update:selectedIconIndexes': [indexes: number[]]
}>()
const { t } = useI18n()
const propertyEditorRef = ref<InstanceType<typeof PropertyEditor> | null>(null)
const filterQuery = ref('')

const selectedIconIndexes = computed(() => props.selectedIconIndexes.filter(index => (
  Number.isInteger(index) && index >= 0 && index < props.series.icons.length
)))
const selectedIconIndex = computed(() => selectedIconIndexes.value[0] ?? null)
const selectedIcon = computed<ProjectIcon | null>(() => {
  const index = selectedIconIndex.value
  return index === null ? null : props.series.icons[index] ?? null
})
const iconPropertyCategories = computed<ReadonlyMap<string, PropertyEditorCategoryDefinition>>(() => new Map([
  ['identity', { title: t('projectConfig.icons.identity'), icon: 'data.symbol-class' }],
  ['appearance', { title: t('projectConfig.icons.appearance'), icon: 'file.image' }],
]))
/** Boundary moves are disabled on the node that cannot move further, with the reason the action button surfaces. */
function iconNodeActions(index: number): {
  inline: readonly OcNodeAction[]
  context: readonly OcNodeContextEntry[]
} {
  const atTop = index === 0
  const atBottom = index === props.series.icons.length - 1
  const boundary = (blocked: boolean, reason: string): Partial<OcNodeAction> => (
    blocked ? { disabled: true, disabledReason: t(reason) } : {}
  )
  const duplicate: OcNodeAction = { key: 'duplicate', title: t('projectConfig.icons.duplicateIcon'), icon: 'action.copy' }
  const moveTop: OcNodeAction = {
    key: 'move-top', title: t('projectConfig.icons.moveToTop'), icon: 'format.vertical-top',
    ...boundary(atTop, 'projectConfig.icons.alreadyAtTop'),
  }
  const moveUp: OcNodeAction = {
    key: 'move-up', title: t('propertyEditor.arrays.moveUp'), icon: 'nav.arrow-up',
    ...boundary(atTop, 'projectConfig.icons.alreadyAtTop'),
  }
  const moveDown: OcNodeAction = {
    key: 'move-down', title: t('propertyEditor.arrays.moveDown'), icon: 'nav.arrow-down',
    ...boundary(atBottom, 'projectConfig.icons.alreadyAtBottom'),
  }
  const moveBottom: OcNodeAction = {
    key: 'move-bottom', title: t('projectConfig.icons.moveToBottom'), icon: 'format.vertical-bottom',
    ...boundary(atBottom, 'projectConfig.icons.alreadyAtBottom'),
  }
  const remove: OcNodeAction = {
    key: 'delete', title: t('projectConfig.icons.removeIcon'), icon: 'action.delete', iconTone: 'danger',
  }
  return {
    inline: [duplicate, moveTop, moveUp, moveDown, moveBottom, remove],
    context: [
      duplicate,
      { type: 'divider', key: 'icon-move-divider' },
      moveTop,
      moveUp,
      moveDown,
      moveBottom,
      { type: 'divider', key: 'icon-delete-divider' },
      remove,
    ],
  }
}

const entriesByIdentity = computed(() => new Map(props.entries.map(entry => (
  [projectIconIdentity(entry.seriesKey, entry.iconKey), entry]
))))

/** The catalog already reports every icon whose file failed to load. */
function catalogEntry(index: number): ProjectIconCatalogEntry | null {
  const icon = props.series.icons[index]
  if (!icon) return null
  return entriesByIdentity.value.get(projectIconIdentity(props.series.key, icon.iconKey)) ?? null
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
const iconTreeData = computed<OcNodeCollection>(() => {
  const rootKeys = filteredIconIndexes.value.map(index => `icon:${index}`)
  return {
    rootKeys,
    items: new Map(filteredIconIndexes.value.map((index): [string, OcNode] => {
      const key = `icon:${index}`
      const icon = props.series.icons[index]!
      const entry = catalogEntry(index)
      const actions = iconNodeActions(index)
      return [key, {
        label: icon.name,
        visual: entry
          ? { type: 'style' as const, style: createProjectIconStyle(entry, readProjectIconSize), label: icon.name }
          : { type: 'icon' as const, icon: 'file.image' },
        draggable: true,
        tail: actions.inline,
        contextActions: actions.context,
      }]
    })),
    children: new Map(),
  }
})
const selectedTreeKeys = computed(() => selectedIconIndexes.value.map(index => `icon:${index}`))
const iconPropertyInputs = computed<PropertyEditorInput[]>(() => {
  const index = selectedIconIndex.value
  const icon = selectedIcon.value
  if (index === null || !icon) return []
  return [{
    key: `icon:${index}`,
    title: icon.name,
    record: {
      iconKey: icon.iconKey,
      name: icon.name,
      tint: icon.tint,
      pixelated: String(icon.pixelated ?? false),
      rotation: `${icon.rotation ?? 0}°`,
    },
    fields: {
      iconKey: { title: t('projectConfig.icons.referenceName'), fieldType: 'string', category: 'identity', order: 1, required: true, commitMode: 'blur' },
      name: { title: t('projectConfig.icons.iconName'), fieldType: 'string', category: 'identity', order: 2, commitMode: 'blur' },
      tint: {
        title: t('projectConfig.icons.tint'), fieldType: 'string', category: 'appearance', order: 1,
        options: [...PROJECT_ICON_TINTS],
        optionLabels: {
          theme: t('projectConfig.icons.tintTheme'),
          original: t('projectConfig.icons.tintOriginal'),
        },
        presentation: 'select',
      },
      pixelated: { title: t('projectConfig.icons.pixelated'), fieldType: 'boolean', category: 'appearance', order: 2 },
      rotation: {
        title: t('projectConfig.icons.rotation'), fieldType: 'string', category: 'appearance', order: 3,
        options: PROJECT_ICON_ROTATIONS.map(value => `${value}°`), presentation: 'select',
      },
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

function handleSelectionChange(event: OcNodeSelectionEvent): void {
  emit('update:selectedIconIndexes', event.selectedKeys
    .map(key => treeIndex(key))
    .filter((index): index is number => index !== null))
}

function handleNodeMove(event: OcNodeMoveEvent): void {
  const fromIndex = treeIndex(event.key)
  const targetIndex = treeIndex(event.targetKey)
  if (fromIndex === null || targetIndex === null) return
  let toIndex = targetIndex + (event.position === 'after' ? 1 : 0)
  if (fromIndex < toIndex) toIndex -= 1
  moveIcon(fromIndex, toIndex)
}

function handleNodeAction(event: OcNodeActionEvent): void {
  const index = treeIndex(event.key)
  if (index === null) return
  const indexes = event.source === 'context' && ['delete', 'move-top', 'move-up', 'move-down', 'move-bottom'].includes(event.actionKey)
    ? selectedIconIndexes.value
    : selectedIconIndex.value === null ? [index] : [selectedIconIndex.value]
  if (event.actionKey === 'duplicate') duplicateIcon(indexes[0] ?? index)
  else if (event.actionKey === 'delete') removeIcons(indexes)
  else if (event.actionKey === 'move-top') moveIcons(indexes, 'top')
  else if (event.actionKey === 'move-up') moveIcons(indexes, 'up')
  else if (event.actionKey === 'move-down') moveIcons(indexes, 'down')
  else if (event.actionKey === 'move-bottom') moveIcons(indexes, 'bottom')
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
  const icon = props.series.icons[index]
  if (!icon) return
  const icons = [...props.series.icons]
  icons[index] = { ...icon, ...patch }
  emit('update:series', { ...props.series, icons })
}

function updateIconProperty(mutation: PropertyEditorMutation): void {
  const index = selectedIconIndex.value
  if (index === null) return
  if (mutation.fieldKey === 'iconKey') updateIcon(index, { iconKey: String(mutation.value) })
  else if (mutation.fieldKey === 'name') updateIcon(index, { name: String(mutation.value) })
  else if (mutation.fieldKey === 'tint') {
    updateIcon(index, { tint: mutation.value === 'original' ? 'original' : 'theme' })
  } else if (mutation.fieldKey === 'pixelated') {
    updateIcon(index, { pixelated: mutation.value === true || mutation.value === 'true' })
  } else if (mutation.fieldKey === 'rotation') {
    const value = Number(String(mutation.value).replace('°', ''))
    if ((PROJECT_ICON_ROTATIONS as readonly number[]).includes(value)) {
      updateIcon(index, { rotation: value as ProjectIconRotation })
    }
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
  grid-template-columns: repeat(2, minmax(0, 1fr));
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
