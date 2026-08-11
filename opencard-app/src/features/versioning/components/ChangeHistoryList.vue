<template>
  <div class="change-history-list">
    <OcTree
      v-if="treeData.rootKeys.length > 0"
      :data="treeData"
      :actions="actions"
      :selected-keys="selectedKeys"
      role="listbox"
      selection-mode="single"
      activation-mode="single-click"
      @intent="handleIntent"
    />
    <div v-else class="shell-sidebar-empty">
      <span>{{ emptyLabel }}</span>
    </div>
    <p v-if="error" class="change-history-list__error" role="alert">{{ error }}</p>
    <OcButton
      v-if="nextCursor && sourceFilter !== 'local-history'"
      block
      size="sm"
      variant="ghost"
      :disabled="busy"
      @click="emit('load-more')"
    >
      {{ busy ? t('versioning.list.loadingMore') : t('versioning.list.loadMore') }}
    </OcButton>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { LocalHistoryEntryDto, VersionRecordDto } from '../model/versioning'

type ChangeHistorySourceFilter = 'all' | 'version' | 'local-history'

const props = withDefaults(defineProps<{
  versions: readonly VersionRecordDto[]
  localHistory: readonly LocalHistoryEntryDto[]
  emptyLabel: string
  locale: string
  sourceFilter?: ChangeHistorySourceFilter
  activeCompareKey?: string | null
  nextCursor: string | null
  busy: boolean
  error: string | null
}>(), {
  sourceFilter: 'all',
  activeCompareKey: null,
})
const emit = defineEmits<{
  select: [source: 'version' | 'local-history', id: string]
  info: [commitId: string]
  restore: [entryId: string]
  delete: [entryId: string]
  'load-more': []
}>()
const { t } = useI18n()
const selectedKeys = ref<string[]>([])
const actions = computed(() => new Map([
  ['history.compare', {
    title: t('versioning.history.compareWithCurrent'),
    icon: 'status.eye' as const,
  }],
  ['history.info', {
    title: t('versioning.history.viewVersionInfo'),
    icon: 'data.version' as const,
  }],
  ['history.restore', {
    title: t('versioning.history.restoreContent'),
    icon: 'action.undo' as const,
  }],
  ['history.delete', {
    title: t('versioning.history.deleteRecord'),
    icon: 'action.delete' as const,
    iconTone: 'danger' as const,
  }],
]))

function relativeTime(timestamp: number): string {
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(deltaSeconds)
  const [value, unit] = absoluteSeconds < 60
    ? [deltaSeconds, 'second'] as const
    : absoluteSeconds < 3600
      ? [Math.round(deltaSeconds / 60), 'minute'] as const
      : absoluteSeconds < 86400
        ? [Math.round(deltaSeconds / 3600), 'hour'] as const
        : [Math.round(deltaSeconds / 86400), 'day'] as const
  return new Intl.RelativeTimeFormat(props.locale, { numeric: 'auto' }).format(value, unit)
}

const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const rows = [
    ...props.versions.map((version, order) => ({
      key: `version:${version.commitId}` as const,
      source: 'version' as const,
      id: version.commitId,
      timestamp: version.savedAtUnixMs,
      order,
      label: `v${version.version}`,
      description: version.description,
      tail: relativeTime(version.savedAtUnixMs),
      icon: 'data.version' as const,
      iconTone: version.release ? 'success' as const : undefined,
      contextActions: ['history.compare', 'history.info'],
    })),
    ...props.localHistory.map((entry, order) => ({
      key: `local-history:${entry.entryId}` as const,
      source: 'local-history' as const,
      id: entry.entryId,
      timestamp: entry.createdAtUnixMs,
      order: props.versions.length + order,
      label: new Date(entry.createdAtUnixMs).toLocaleString(props.locale),
      description: entry.sourceDescription || t(`versioning.history.sources.${entry.source}`, entry.source),
      tail: relativeTime(entry.createdAtUnixMs),
      icon: 'action.save' as const,
      iconTone: undefined,
      contextActions: ['history.compare', 'history.restore', 'history.delete'],
      disabledActions: props.activeCompareKey === `local-history:${entry.entryId}`
        ? new Map([['history.delete', t('versioning.history.deleteOpenComparison')]])
        : undefined,
    })),
  ]
    .filter(row => props.sourceFilter === 'all' || row.source === props.sourceFilter)
    .sort((left, right) => right.timestamp - left.timestamp || left.order - right.order)
  for (const { timestamp: _timestamp, order: _order, source: _source, id: _id, ...row } of rows) {
    items.set(row.key, row)
  }
  return { rootKeys: rows.map(row => row.key), items, children: new Map() }
})

watch(treeData, data => {
  if (selectedKeys.value.some(key => !data.items.has(key))) selectedKeys.value = []
})

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'action.invoke') {
    const { source, id } = parseHistoryKey(intent.key)
    if (intent.actionKey === 'history.compare') emit('select', source, id)
    else if (intent.actionKey === 'history.info' && source === 'version') emit('info', id)
    else if (intent.actionKey === 'history.restore' && source === 'local-history') emit('restore', id)
    else if (intent.actionKey === 'history.delete' && source === 'local-history') emit('delete', id)
    return
  }
  if (intent.type === 'selection.change') {
    selectedKeys.value = intent.selectedKeys
    return
  }
  if (intent.type !== 'node.activate') return
  selectedKeys.value = [intent.key]
  const { source, id } = parseHistoryKey(intent.key)
  emit('select', source, id)
}

function parseHistoryKey(key: string): { source: 'version' | 'local-history', id: string } {
  const source = key.startsWith('version:') ? 'version' : 'local-history'
  return {
    source,
    id: key.slice(source === 'version' ? 'version:'.length : 'local-history:'.length),
  }
}
</script>

<style scoped>
.change-history-list {
  display: grid;
  min-height: 0;
}

.change-history-list__error {
  margin: var(--oc-space-2);
  color: var(--oc-fg-danger);
}
</style>
