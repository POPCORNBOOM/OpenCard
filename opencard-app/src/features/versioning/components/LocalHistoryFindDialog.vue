<template>
  <OcDialog
    :open="open"
    :title="t('versioning.history.find.title')"
    :description="selectedPath ? selectedPath : t('versioning.history.find.description')"
    size="lg"
    height-mode="fixed"
    height="lg"
    :dismissible="!busy"
    :scrollable="false"
    @request-close="emit('close')"
  >
    <div class="local-history-find-dialog">
      <div v-if="!selectedPath" class="local-history-find-dialog__search">
        <OcFieldInput
          :value="query"
          full-width
          autofocus
          :placeholder="t('versioning.history.find.placeholder')"
          :disabled="busy"
          @input="query = fieldValue($event)"
          @keydown.enter.prevent="emit('search', query)"
        />
        <OcButton icon="action.search" :disabled="busy" @click="emit('search', query)">
          {{ t('versioning.history.find.search') }}
        </OcButton>
      </div>
      <OcButton v-else size="sm" variant="ghost" icon="nav.arrow-left" @click="emit('back')">
        {{ t('versioning.history.find.back') }}
      </OcButton>
      <p v-if="error" class="local-history-find-dialog__error" role="alert">{{ error }}</p>
      <OcTree
        v-if="treeData.rootKeys.length > 0"
        fill
        :data="treeData"
        :selected-keys="selectedKeys"
        role="listbox"
        selection-mode="single"
        activation-mode="single-click"
        @intent="handleIntent"
      />
      <div v-else class="local-history-find-dialog__empty">
        {{ busy ? t('versioning.history.find.loading') : emptyLabel }}
      </div>
    </div>
    <template #footer>
      <OcButton
        v-if="!selectedPath && nextCursor"
        type="button"
        variant="ghost"
        :disabled="busy"
        @click="emit('load-more')"
      >
        {{ t('versioning.history.find.loadMore') }}
      </OcButton>
      <span class="local-history-find-dialog__footer-spacer" />
      <OcButton type="button" :disabled="busy" @click="emit('close')">
        {{ t('versioning.actions.close') }}
      </OcButton>
    </template>
  </OcDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcButton from '../../../components/base/OcButton.vue'
import OcFieldInput from '../../../components/base/OcFieldInput.vue'
import OcDialog from '../../../components/standard/OcDialog.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent, OcTreeItem } from '../../../shared/ui/tree/tree.types'
import type { LocalHistoryEntryDto, LocalHistoryFileRecordDto } from '../model/versioning'

const props = defineProps<{
  open: boolean
  files: readonly LocalHistoryFileRecordDto[]
  entries: readonly LocalHistoryEntryDto[]
  selectedPath: string | null
  nextCursor: string | null
  locale: string
  busy: boolean
  error: string
}>()
const emit = defineEmits<{
  close: []
  search: [query: string]
  'select-path': [relativePath: string]
  'select-entry': [entry: LocalHistoryEntryDto]
  back: []
  'load-more': []
}>()
const { t } = useI18n()
const query = ref('')
const selectedKeys = ref<string[]>([])

const emptyLabel = computed(() => props.selectedPath
  ? t('versioning.history.find.noEntries')
  : t('versioning.history.find.empty'))

const treeData = computed<OcTreeData>(() => {
  const items = new Map<string, OcTreeItem>()
  if (props.selectedPath) {
    for (const entry of props.entries) {
      const key = `entry:${entry.entryId}`
      items.set(key, {
        label: new Date(entry.createdAtUnixMs).toLocaleString(props.locale),
        description: entry.sourceDescription || t(`versioning.history.sources.${entry.source}`, entry.source),
        icon: 'action.save',
      })
    }
  } else {
    for (const file of props.files) {
      const key = `path:${file.relativePath}`
      items.set(key, {
        label: file.relativePath,
        description: t(file.currentlyExists
          ? 'versioning.history.find.filePresent'
          : 'versioning.history.find.fileMissing', { count: file.entryCount }),
        tail: new Date(file.latestEntryAtUnixMs).toLocaleString(props.locale),
        icon: file.currentlyExists ? 'file.generic' : 'status.warning',
        iconTone: file.currentlyExists ? undefined : 'warning',
      })
    }
  }
  return { rootKeys: [...items.keys()], items, children: new Map() }
})

watch(() => props.selectedPath, () => { selectedKeys.value = [] })

function fieldValue(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function handleIntent(intent: OcTreeIntent): void {
  if (intent.type === 'selection.change') {
    selectedKeys.value = intent.selectedKeys
    return
  }
  if (intent.type !== 'node.activate') return
  selectedKeys.value = [intent.key]
  if (intent.key.startsWith('path:')) {
    emit('select-path', intent.key.slice('path:'.length))
    return
  }
  const entry = props.entries.find(candidate => `entry:${candidate.entryId}` === intent.key)
  if (entry) emit('select-entry', entry)
}
</script>

<style scoped>
.local-history-find-dialog {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  gap: var(--oc-space-3);
  height: 100%;
  min-height: 0;
}

.local-history-find-dialog__search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--oc-space-2);
}

.local-history-find-dialog__empty {
  display: grid;
  place-items: center;
  color: var(--oc-fg-muted);
}

.local-history-find-dialog__error {
  margin: 0;
  color: var(--oc-fg-danger);
}

.local-history-find-dialog__footer-spacer {
  flex: 1;
}
</style>
