<template>
  <section class="version-diff-host" :aria-label="t('versioning.diff.title', { file: fileName })">
    <OcBar icon="data.version" :title="t('versioning.diff.title', { file: fileName })">
      <template #append>
        <span class="version-diff-host__sides">
          {{ session.historicalLabel ?? t('versioning.diff.historical') }} → {{ t('versioning.diff.current') }}
        </span>
        <OcButton
          v-if="loadFailed"
          size="sm"
          variant="ghost"
          icon="action.refresh"
          @click="loadComparison"
        >
          {{ t('versioning.actions.refresh') }}
        </OcButton>
        <OcButton
          v-if="canRestoreMissingFile"
          size="sm"
          variant="ghost"
          icon="action.undo"
          :disabled="loading"
          @click="emit('restore-file')"
        >
          {{ t('versioning.diff.restoreFile') }}
        </OcButton>
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
      v-else-if="comparison && (isTextComparison || dictionaryFallback || projectConfigFallback || fontRegistryFallback || iconRegistryFallback || cardFallback || customBlockRegistryFallback)"
      class="version-diff-host__editor"
      model-value=""
      :language="language"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
      :comparison="comparison"
      read-only
    />
    <DictionaryDiffEditor
      v-else-if="comparison && fileType.editorId === 'dictionary'"
      :historical="session.historical"
      :current="session.current"
      :comparison="comparison"
      :file-name="fileName"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
    />
    <ProjectConfigEditor
      v-else-if="comparison && fileType.editorId === 'project-config'"
      :file-path="snapshotPath(session.current)"
      :file-name="fileName"
      :resource-root-path="session.current.rootPath"
      :comparison-resource-root-path="session.historical.rootPath"
      :model-value="comparison.currentContent"
      :comparison-content="comparison.historicalContent"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
      access="observe-only"
    />
    <SnapshotFontRegistryDiffEditor
      v-else-if="comparison && fileType.editorId === 'font-registry'"
      :historical="session.historical"
      :current="session.current"
      :comparison="comparison"
      :file-name="fileName"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
    />
    <SnapshotIconRegistryDiffEditor
      v-else-if="comparison && fileType.editorId === 'icon-registry'"
      :historical="session.historical"
      :current="session.current"
      :comparison="comparison"
      :file-name="fileName"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
    />
    <SnapshotCardDiffEditor
      v-else-if="comparison && fileType.editorId === 'card-designer'"
      :historical="session.historical"
      :current="session.current"
      :comparison="comparison"
      :file-name="fileName"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
    />
    <SnapshotCustomBlockRegistryDiffEditor
      v-else-if="comparison && fileType.editorId === 'custom-block-registry'"
      :historical="session.historical"
      :current="session.current"
      :comparison="comparison"
      :file-name="fileName"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
    />
    <SnapshotCustomBlockPackageDiffEditor
      v-else-if="loaded && fileType.editorId === 'custom-block-package'"
      :historical="session.historical"
      :current="session.current"
      :file-name="fileName"
    />
    <SnapshotResourceDiffEditor
      v-else-if="loaded && resourceKind"
      :historical="session.historical"
      :current="session.current"
      :kind="resourceKind"
      :file-name="fileName"
    />
    <section v-else-if="loaded" class="version-diff-host__unsupported" aria-live="polite">
      <OcIcon :name="fileType.icon" :tone="fileType.iconTone" size="lg" />
      <strong>{{ t(fileType.labelKey) }}</strong>
      <p>{{ t('versioning.diff.structuredPending') }}</p>
      <dl>
        <div><dt>{{ t('versioning.diff.historical') }}</dt><dd>{{ sideSummary(session.historical) }}</dd></div>
        <div><dt>{{ t('versioning.diff.current') }}</dt><dd>{{ sideSummary(session.current) }}</dd></div>
      </dl>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import OcBar from '../../../components/standard/OcBar.vue'
import OcButton from '../../../components/base/OcButton.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import MonacoEditor from '../../../components/editors/MonacoEditor.vue'
import SnapshotResourceDiffEditor from './SnapshotResourceDiffEditor.vue'
import DictionaryDiffEditor from './DictionaryDiffEditor.vue'
import ProjectConfigEditor from '../../../components/editors/ProjectConfigEditor.vue'
import SnapshotFontRegistryDiffEditor from './SnapshotFontRegistryDiffEditor.vue'
import SnapshotIconRegistryDiffEditor from './SnapshotIconRegistryDiffEditor.vue'
import SnapshotCardDiffEditor from './SnapshotCardDiffEditor.vue'
import SnapshotCustomBlockRegistryDiffEditor from './SnapshotCustomBlockRegistryDiffEditor.vue'
import SnapshotCustomBlockPackageDiffEditor from './SnapshotCustomBlockPackageDiffEditor.vue'
import type { OcThemeColorOverrides, OcThemeId } from '../../../shared/ui/foundation'
import type { TextEditorComparison } from '../../editor-runtime/model/editorComparison'
import { fileSystemService } from '../../workspace/services/fileSystemService'
import type { CompareSession, SnapshotDescriptorDto } from '../model/versioning'
import { resolveFileType } from '../../workspace/model/fileTypes'
import { parseProjectDictionaryText } from '../../workspace/model/projectDictionary'
import { parseProjectMetadataText } from '../../workspace/model/projectMetadata'
import { parseProjectFontRegistryText } from '../../workspace/model/projectFontRegistry'
import { parseProjectIconRegistryText } from '../../workspace/model/projectIconRegistry'
import { findProjectIconKeyConflicts } from '../../workspace/model/projectIcons'
import { parseProjectCustomBlockRegistryText } from '../../workspace/model/projectCustomBlocks'
import { parseCardDocument } from '../../../entities/card/storage'

const props = defineProps<{
  session: CompareSession
  language: string
  themeId: OcThemeId
  themeOverrides?: OcThemeColorOverrides
}>()
const emit = defineEmits<{ close: []; 'restore-file': [] }>()
const { t } = useI18n()
const loading = ref(true)
const loadFailed = ref(false)
const comparison = ref<TextEditorComparison | null>(null)
const loaded = ref(false)
let loadGeneration = 0

const fileName = computed(() => (
  props.session.sourcePath.replace(/\\/g, '/').split('/').pop() ?? props.session.sourcePath
))
const canRestoreMissingFile = computed(() => (
  props.session.openedFromHistorySource === 'local-history'
  && !props.session.current.exists
))
const fileType = computed(() => resolveFileType(props.session.sourcePath))
const isTextComparison = computed(() => fileType.value.editorId === 'monaco')
const structuredSidesPresent = computed(() => props.session.historical.exists && props.session.current.exists)
const resourceKind = computed<'image' | 'font' | null>(() => {
  if (fileType.value.editorId === 'image-preview') return 'image'
  if (fileType.value.editorId === 'font-preview') return 'font'
  return null
})
const dictionaryFallback = computed(() => (
  fileType.value.editorId === 'dictionary'
  && Boolean(comparison.value)
  && (!structuredSidesPresent.value
    || !parseProjectDictionaryText(comparison.value!.historicalContent)
    || !parseProjectDictionaryText(comparison.value!.currentContent))
))
const projectConfigFallback = computed(() => (
  fileType.value.editorId === 'project-config'
  && Boolean(comparison.value)
  && (!structuredSidesPresent.value
    || !parseProjectMetadataText(comparison.value!.historicalContent)
    || !parseProjectMetadataText(comparison.value!.currentContent))
))
const fontRegistryFallback = computed(() => (
  fileType.value.editorId === 'font-registry'
  && Boolean(comparison.value)
  && (!structuredSidesPresent.value
    || !parseProjectFontRegistryText(comparison.value!.historicalContent)
    || !parseProjectFontRegistryText(comparison.value!.currentContent))
))
const iconRegistryFallback = computed(() => (
  fileType.value.editorId === 'icon-registry'
  && Boolean(comparison.value)
  && (!structuredSidesPresent.value
    || !isValidIconRegistryComparison(comparison.value!.historicalContent, comparison.value!.currentContent))
))
const cardFallback = computed(() => (
  fileType.value.editorId === 'card-designer'
  && Boolean(comparison.value)
  && (!structuredSidesPresent.value
    || !isValidCardContent(comparison.value!.historicalContent)
    || !isValidCardContent(comparison.value!.currentContent))
))
const customBlockRegistryFallback = computed(() => (
  fileType.value.editorId === 'custom-block-registry'
  && Boolean(comparison.value)
  && (!structuredSidesPresent.value
    || !parseProjectCustomBlockRegistryText(comparison.value!.historicalContent)
    || !parseProjectCustomBlockRegistryText(comparison.value!.currentContent))
))

function isValidCardContent(content: string): boolean {
  try {
    return Boolean(parseCardDocument(JSON.parse(content) as unknown))
  } catch {
    return false
  }
}

function isValidIconRegistryComparison(historicalContent: string, currentContent: string): boolean {
  const historical = parseProjectIconRegistryText(historicalContent)
  const current = parseProjectIconRegistryText(currentContent)
  return Boolean(historical && current
    && findProjectIconKeyConflicts(historical.iconSeries).length === 0
    && findProjectIconKeyConflicts(current.iconSeries).length === 0)
}

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}

function sideSummary(snapshot: SnapshotDescriptorDto): string {
  if (!snapshot.exists) return t('versioning.diff.missing')
  return snapshot.completeness === 'single-file'
    ? t('versioning.diff.singleFile')
    : t('versioning.diff.projectSnapshot')
}

async function readSnapshot(snapshot: SnapshotDescriptorDto): Promise<string> {
  return snapshot.exists ? await fileSystemService.readFile(snapshotPath(snapshot)) : ''
}

async function loadComparison(): Promise<void> {
  const requestGeneration = ++loadGeneration
  loading.value = true
  loadFailed.value = false
  loaded.value = false
  comparison.value = null
  try {
    if (!isTextComparison.value && !['dictionary', 'project-config', 'font-registry', 'icon-registry', 'card-designer', 'custom-block-registry'].includes(fileType.value.editorId)) {
      loaded.value = true
      return
    }
    const [historicalContent, currentContent] = await Promise.all([
      readSnapshot(props.session.historical),
      readSnapshot(props.session.current),
    ])
    if (requestGeneration !== loadGeneration) return
    comparison.value = {
      historicalContent,
      currentContent,
      historicalLabel: props.session.historicalLabel ?? t('versioning.diff.historical'),
      currentLabel: t('versioning.diff.current'),
    }
    loaded.value = true
  } catch {
    if (requestGeneration === loadGeneration) loadFailed.value = true
  } finally {
    if (requestGeneration === loadGeneration) loading.value = false
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (document.querySelector('.oc-dialog[role="dialog"], .oc-action-menu[role="menu"]')) return
  event.preventDefault()
  emit('close')
}

watch(() => props.session.id, () => void loadComparison(), { immediate: true })
onMounted(() => document.addEventListener('keydown', handleKeydown, true))
onBeforeUnmount(() => {
  loadGeneration += 1
  document.removeEventListener('keydown', handleKeydown, true)
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

.version-diff-host__unsupported {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--oc-space-3);
  min-height: 0;
  padding: var(--oc-space-8);
  color: var(--oc-fg-muted);
  text-align: center;
}

.version-diff-host__unsupported strong {
  color: var(--oc-fg-default);
}

.version-diff-host__unsupported p {
  max-width: 34rem;
  margin: 0;
}

.version-diff-host__unsupported dl {
  display: grid;
  gap: var(--oc-space-2);
  width: min(34rem, 100%);
  margin: var(--oc-space-3) 0 0;
  text-align: left;
}

.version-diff-host__unsupported dl > div {
  display: grid;
  grid-template-columns: 10rem minmax(0, 1fr);
  gap: var(--oc-space-3);
}

.version-diff-host__unsupported dt {
  color: var(--oc-fg-subtle);
}

.version-diff-host__unsupported dd {
  margin: 0;
  color: var(--oc-fg-default);
}
</style>
