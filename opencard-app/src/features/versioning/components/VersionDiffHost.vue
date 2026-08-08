<template>
  <section class="version-diff-host" :aria-label="t('versioning.diff.title', { file: fileName })">
    <OcBar icon="data.version" :title="t('versioning.diff.title', { file: fileName })">
      <template #append>
        <span class="version-diff-host__sides">
          {{ t('versioning.diff.historical') }} → {{ t('versioning.diff.current') }}
        </span>
        <OcButton
          icon-only
          size="sm"
          variant="ghost"
          icon="action.close"
          :aria-label="t('versioning.diff.close')"
          :data-tooltip="t('versioning.diff.close')"
          @click="emit('close')"
        />
      </template>
    </OcBar>
    <div v-if="loading" class="version-diff-host__state">
      {{ t('versioning.diff.loading') }}
    </div>
    <div v-else-if="loadFailed" class="version-diff-host__state" role="alert">
      {{ t('versioning.diff.loadFailed') }}
    </div>
    <MonacoEditor
      v-else-if="comparison"
      class="version-diff-host__editor"
      model-value=""
      :language="language"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
      :comparison="comparison"
      read-only
    />
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcBar from '../../../components/standard/OcBar.vue'
import OcButton from '../../../components/base/OcButton.vue'
import MonacoEditor from '../../../components/editors/MonacoEditor.vue'
import type { OcThemeColorOverrides, OcThemeId } from '../../../shared/ui/foundation'
import type { TextEditorComparison } from '../../editor-runtime/model/editorComparison'
import { fileSystemService } from '../../workspace/services/fileSystemService'
import type { CompareSession, SnapshotDescriptorDto } from '../model/versioning'

const props = defineProps<{
  session: CompareSession
  language: string
  themeId: OcThemeId
  themeOverrides?: OcThemeColorOverrides
}>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const loading = ref(true)
const loadFailed = ref(false)
const comparison = ref<TextEditorComparison | null>(null)
let loadGeneration = 0

const fileName = computed(() => (
  props.session.sourcePath.replace(/\\/g, '/').split('/').pop() ?? props.session.sourcePath
))

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}

async function readSnapshot(snapshot: SnapshotDescriptorDto): Promise<string> {
  return snapshot.exists ? await fileSystemService.readFile(snapshotPath(snapshot)) : ''
}

async function loadComparison(): Promise<void> {
  const requestGeneration = ++loadGeneration
  loading.value = true
  loadFailed.value = false
  try {
    const [historicalContent, currentContent] = await Promise.all([
      readSnapshot(props.session.historical),
      readSnapshot(props.session.current),
    ])
    if (requestGeneration !== loadGeneration) return
    comparison.value = {
      historicalContent,
      currentContent,
      historicalLabel: t('versioning.diff.historical'),
      currentLabel: t('versioning.diff.current'),
    }
  } catch {
    if (requestGeneration === loadGeneration) loadFailed.value = true
  } finally {
    if (requestGeneration === loadGeneration) loading.value = false
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  event.preventDefault()
  emit('close')
}

watch(() => props.session.id, () => void loadComparison(), { immediate: true })
onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => {
  loadGeneration += 1
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.version-diff-host {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  background: var(--oc-bg-base);
}

.version-diff-host :deep(.oc-bar) {
  border-bottom: 1px solid var(--oc-border-default);
  background: var(--oc-bg-raised);
}

.version-diff-host__sides {
  color: var(--oc-fg-subtle);
  font-size: var(--oc-text-sm);
}

.version-diff-host__editor {
  min-width: 0;
  min-height: 0;
}

.version-diff-host__state {
  display: grid;
  place-items: center;
  color: var(--oc-fg-subtle);
}
</style>
