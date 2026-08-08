<template>
  <div v-if="treeData.rootKeys.length > 0" class="change-history-list">
    <OcTree
      :data="treeData"
      :actions="actions"
      :selected-keys="selectedKeys"
      role="listbox"
      selection-mode="single"
      activation-mode="single-click"
      @intent="handleIntent"
    />
  </div>
  <div v-else class="shell-sidebar-empty">
    <span>{{ emptyLabel }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { LocalHistoryEntryDto, VersionRecordDto } from '../model/versioning'

const props = defineProps<{
  versions: readonly VersionRecordDto[]
  localHistory: readonly LocalHistoryEntryDto[]
  emptyLabel: string
  locale: string
  canRestore: boolean
}>()
const emit = defineEmits<{
  select: [source: 'version' | 'local-history', id: string]
  restore: [entryId: string]
}>()
const { t } = useI18n()
const selectedKeys = ref<string[]>([])
const actions = computed(() => new Map([
  ['local-history.restore', {
    title: t('versioning.actions.restore'),
    icon: 'action.undo' as const,
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
    ...props.versions.map(version => ({
      key: `version:${version.commitId}`,
      source: 'version' as const,
      id: version.commitId,
      label: `v${version.version}`,
      description: version.description,
      tail: relativeTime(version.savedAtUnixMs),
      icon: 'data.version' as const,
      iconTone: version.release ? 'success' as const : undefined,
    })),
    ...props.localHistory.map(entry => ({
      key: `local-history:${entry.entryId}`,
      source: 'local-history' as const,
      id: entry.entryId,
      label: new Date(entry.createdAtUnixMs).toLocaleString(props.locale),
      description: entry.sourceDescription || t(`versioning.history.sources.${entry.source}`, entry.source),
      tail: relativeTime(entry.createdAtUnixMs),
      icon: 'action.save' as const,
      iconTone: undefined,
      actions: ['local-history.restore'],
      disabledActions: props.canRestore
        ? undefined
        : new Map([['local-history.restore', t('versioning.history.saveBeforeRestore')]]),
    })),
  ]
  for (const row of rows) items.set(row.key, row)
  return { rootKeys: rows.map(row => row.key), items, children: new Map() }
})

watch(treeData, data => {
  if (selectedKeys.value.some(key => !data.items.has(key))) selectedKeys.value = []
})

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'action.invoke' && intent.actionKey === 'local-history.restore') {
    emit('restore', intent.key.slice('local-history:'.length))
    return
  }
  if (intent.type === 'selection.change') {
    selectedKeys.value = intent.selectedKeys
    return
  }
  if (intent.type !== 'node.activate') return
  selectedKeys.value = [intent.key]
  const source = intent.key.startsWith('version:') ? 'version' : 'local-history'
  emit('select', source, intent.key.slice(source === 'version' ? 'version:'.length : 'local-history:'.length))
}
</script>
