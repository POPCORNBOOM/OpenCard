<template>
  <section ref="rootRef" class="dictionary-diff-editor">
    <section v-for="side in sides" :key="side.key" class="dictionary-diff-editor__side">
      <header class="dictionary-diff-editor__header">
        <strong>{{ side.marker }}</strong>
        <span>{{ side.label }}</span>
      </header>
      <DictionaryEditor
        :file-path="side.filePath"
        :file-name="fileName"
        :resource-root-path="side.snapshot.rootPath"
        :model-value="side.content"
        :comparison-content="side.comparisonContent"
        :comparison-side="side.key"
        :theme-id="themeId"
        :theme-overrides="themeOverrides"
        access="observe-only"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import DictionaryEditor from '../../../components/editors/DictionaryEditor.vue'
import type { OcThemeColorOverrides, OcThemeId } from '../../../shared/ui/foundation'
import type { TextEditorComparison } from '../../editor-runtime/model/editorComparison'
import type { SnapshotDescriptorDto } from '../model/versioning'

const props = defineProps<{
  historical: SnapshotDescriptorDto
  current: SnapshotDescriptorDto
  comparison: TextEditorComparison
  fileName: string
  themeId: OcThemeId
  themeOverrides?: OcThemeColorOverrides
}>()
const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)
let disposeScrollSync: (() => void) | null = null
const sides = computed(() => [
  {
    key: 'historical' as const,
    marker: 'A',
    label: t('versioning.diff.historical'),
    snapshot: props.historical,
    content: props.comparison.historicalContent,
    comparisonContent: props.comparison.currentContent,
    filePath: snapshotPath(props.historical),
  },
  {
    key: 'current' as const,
    marker: 'B',
    label: t('versioning.diff.current'),
    snapshot: props.current,
    content: props.comparison.currentContent,
    comparisonContent: props.comparison.historicalContent,
    filePath: snapshotPath(props.current),
  },
])

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}

function connectScrollSync(): void {
  const scrollers = rootRef.value?.querySelectorAll<HTMLElement>('.dictionary-editor__table-scroll')
  if (!scrollers || scrollers.length !== 2) return
  const left = scrollers[0]!
  const right = scrollers[1]!
  let syncing = false
  const sync = (source: HTMLElement, target: HTMLElement) => {
    if (syncing) return
    syncing = true
    target.scrollLeft = source.scrollLeft
    target.scrollTop = source.scrollTop
    requestAnimationFrame(() => { syncing = false })
  }
  const syncRight = () => sync(left, right)
  const syncLeft = () => sync(right, left)
  left.addEventListener('scroll', syncRight)
  right.addEventListener('scroll', syncLeft)
  disposeScrollSync = () => {
    left.removeEventListener('scroll', syncRight)
    right.removeEventListener('scroll', syncLeft)
  }
}

onMounted(connectScrollSync)
onBeforeUnmount(() => disposeScrollSync?.())
</script>

<style scoped>
.dictionary-diff-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.dictionary-diff-editor__side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.dictionary-diff-editor__side + .dictionary-diff-editor__side {
  border-left: var(--oc-border-width) solid var(--oc-border-default);
}

.dictionary-diff-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-2) var(--oc-space-3);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.dictionary-diff-editor__header strong {
  color: var(--oc-fg-default);
}
</style>
