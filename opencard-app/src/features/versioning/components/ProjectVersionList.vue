<template>
  <div class="project-version-list">
    <OcTree
      v-if="treeData.rootKeys.length > 0"
      :data="treeData"
      :selected-keys="selectedKeys"
      role="listbox"
      selection-mode="single"
      activation-mode="single-click"
      @intent="handleIntent"
    />
    <div v-else class="shell-sidebar-empty">
      <span>{{ emptyLabel }}</span>
    </div>
    <p v-if="error" class="project-version-list__error" role="alert">{{ error }}</p>
    <OcButton
      v-if="nextCursor"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { VersionRecordDto } from '../model/versioning'

const props = defineProps<{
  versions: readonly VersionRecordDto[]
  currentCommitId: string | null
  selectedKeys: readonly string[]
  nextCursor: string | null
  locale: string
  emptyLabel: string
  busy: boolean
  error: string | null
}>()
const emit = defineEmits<{
  select: [keys: string[]]
  activate: [commitId: string]
  'load-more': []
}>()
const { t } = useI18n()

function relativeTime(timestamp: number): string {
  const deltaSeconds = Math.round((timestamp - Date.now()) / 1000)
  const absoluteSeconds = Math.abs(deltaSeconds)
  const [value, unit] = absoluteSeconds < 60
    ? [deltaSeconds, 'second'] as const
    : absoluteSeconds < 3600
      ? [Math.round(deltaSeconds / 60), 'minute'] as const
      : absoluteSeconds < 86400
        ? [Math.round(deltaSeconds / 3600), 'hour'] as const
        : absoluteSeconds < 2592000
          ? [Math.round(deltaSeconds / 86400), 'day'] as const
          : [Math.round(deltaSeconds / 2592000), 'month'] as const
  return new Intl.RelativeTimeFormat(props.locale, { numeric: 'auto' }).format(value, unit)
}

const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  const rootKeys = props.versions.map(version => {
    const key = `version:${version.commitId}`
    const isCurrent = props.currentCommitId === version.commitId
    const labels = [
      isCurrent ? t('versioning.list.current') : undefined,
      version.release ? t('versioning.list.published') : t('versioning.list.saved'),
      relativeTime(version.savedAtUnixMs),
    ].filter((value): value is string => Boolean(value))
    items.set(key, {
      label: `v${version.version}`,
      description: version.description.split(/\r?\n/, 1)[0],
      tail: labels.join(' · '),
      icon: 'data.version',
      iconTone: isCurrent ? 'primary' : version.release ? 'success' : undefined,
    })
    return key
  })
  return { rootKeys, items, children: new Map() }
})

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    emit('select', intent.selectedKeys)
    return
  }
  if (intent.type !== 'node.activate') return
  emit('select', [intent.key])
  emit('activate', intent.key.replace(/^version:/, ''))
}
</script>

<style scoped>
.project-version-list {
  display: grid;
  min-height: 0;
}

.project-version-list__error {
  margin: var(--oc-space-2);
  color: var(--oc-fg-danger);
}
</style>
