<template>
  <section class="snapshot-card-diff-editor" :class="`is-layout-${comparisonLayout}`">
    <section
      v-for="side in visibleSides"
      :key="side.key"
      class="snapshot-card-diff-editor__side"
      :class="`is-side-${side.key}`"
    >
      <header class="snapshot-card-diff-editor__header">
        <strong>{{ side.marker }}</strong>
        <span>{{ side.label }}</span>
      </header>
      <OcEmpty v-if="!side.snapshot.exists">{{ t('versioning.diff.missing') }}</OcEmpty>
      <OcEmpty v-else-if="side.error">{{ t('versioning.diff.loadFailed') }}</OcEmpty>
      <OcEmpty v-else-if="side.loading">{{ t('versioning.diff.loading') }}</OcEmpty>
      <CardDesignEditor
        v-else
        :file-path="snapshotPath(side.snapshot)"
        :file-name="fileName"
        :resource-root-path="side.snapshot.rootPath"
        :model-value="side.content"
        :card-designer-view="view"
        :viewport-transform="viewportTransform"
        :comparison-layout="comparisonLayout"
        :comparison-role="side.key"
        :comparison-selected-block-id="selectedBlockId"
        :comparison-changed-block-ids="comparisonChanges?.blockIds ? [...comparisonChanges.blockIds] : undefined"
        :comparison-changed-instance-ids="comparisonChanges?.instanceIds ? [...comparisonChanges.instanceIds] : undefined"
        :comparison-document-changed="comparisonChanges?.documentChanged"
        :comparison-property-inputs="propertyInputs[side.key === 'historical' ? 'current' : 'historical']"
        :theme-id="themeId"
        :theme-overrides="themeOverrides"
        :render-environment="side.environment"
        access="observe-only"
        @update-card-designer-view="view = $event"
        @update-viewport-transform="viewportTransform = $event"
        @update-card-comparison-layout="comparisonLayout = $event"
        @update-card-comparison-selection="selectedBlockId = $event"
        @update-card-comparison-properties="updatePropertyInputs(side.key, $event)"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import CardDesignEditor from '../../card-designer/CardDesignEditor.vue'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import { parseCardDocument } from '../../../entities/card/storage'
import type { CardDesignerViewState, EditorViewportTransform } from '../../editor-runtime/model/editorUiState'
import type { CardComparisonLayout } from '../../editor-runtime/model/editorComparison'
import type { OcThemeColorOverrides, OcThemeId } from '../../../shared/ui/foundation'
import type { TextEditorComparison } from '../../editor-runtime/model/editorComparison'
import type { PropertyEditorInput } from '../../../shared/ui/property-editor/propertyEditor.types'
import type { SnapshotDescriptorDto } from '../model/versioning'
import { createCardComparisonChanges, type CardComparisonChanges } from '../model/cardComparison'
import {
  createSnapshotProjectRenderSession,
  type SnapshotProjectRenderSession,
} from '../services/snapshotProjectRenderSession'

const props = defineProps<{
  historical: SnapshotDescriptorDto
  current: SnapshotDescriptorDto
  comparison: TextEditorComparison
  fileName: string
  themeId: OcThemeId
  themeOverrides?: OcThemeColorOverrides
}>()
const { t } = useI18n()
const view = ref<CardDesignerViewState>({
  activeFace: 'front',
  clipToFace: true,
  alignmentSnappingEnabled: true,
  selectedInstanceId: null,
})
const viewportTransform = ref<EditorViewportTransform>({ x: 0, y: 0, scale: 1 })
const selectedBlockId = ref<string | null>(null)
const comparisonLayout = ref<CardComparisonLayout>('horizontal')
const propertyInputs = shallowRef<Record<'historical' | 'current', readonly PropertyEditorInput[]>>({
  historical: [],
  current: [],
})
const comparisonChanges = computed<CardComparisonChanges | null>(() => {
  try {
    return createCardComparisonChanges(
      parseCardDocument(JSON.parse(props.comparison.historicalContent) as unknown),
      parseCardDocument(JSON.parse(props.comparison.currentContent) as unknown),
    )
  } catch {
    return null
  }
})

function updatePropertyInputs(side: 'historical' | 'current', inputs: readonly PropertyEditorInput[]): void {
  propertyInputs.value = { ...propertyInputs.value, [side]: inputs }
}
const renderSessions = shallowRef<Record<'historical' | 'current', SnapshotProjectRenderSession | null>>({
  historical: null,
  current: null,
})
const loadingSides = ref(new Set<'historical' | 'current'>())
const failedSides = ref(new Set<'historical' | 'current'>())
let loadGeneration = 0
const sides = computed(() => [
  {
    key: 'historical' as const,
    marker: 'A',
    label: t('versioning.diff.historical'),
    snapshot: props.historical,
    content: props.comparison.historicalContent,
    environment: renderSessions.value.historical?.environment,
    loading: loadingSides.value.has('historical'),
    error: failedSides.value.has('historical'),
  },
  {
    key: 'current' as const,
    marker: 'B',
    label: t('versioning.diff.current'),
    snapshot: props.current,
    content: props.comparison.currentContent,
    environment: renderSessions.value.current?.environment,
    loading: loadingSides.value.has('current'),
    error: failedSides.value.has('current'),
  },
])
const visibleSides = computed(() => comparisonLayout.value === 'horizontal' || comparisonLayout.value === 'vertical'
  ? sides.value
  : sides.value.filter(side => side.key === comparisonLayout.value))

function releaseSessions(): void {
  renderSessions.value.historical?.release()
  renderSessions.value.current?.release()
  renderSessions.value = { historical: null, current: null }
}

async function loadRenderSessions(): Promise<void> {
  const generation = ++loadGeneration
  releaseSessions()
  const snapshots = { historical: props.historical, current: props.current }
  const keys = (Object.keys(snapshots) as Array<keyof typeof snapshots>).filter(key => (
    snapshots[key].exists && snapshots[key].completeness !== 'single-file'
  ))
  loadingSides.value = new Set(keys)
  failedSides.value = new Set()
  const results = await Promise.all(keys.map(async key => {
    try {
      return { key, session: await createSnapshotProjectRenderSession(snapshots[key].rootPath) }
    } catch {
      return { key, session: null }
    }
  }))
  if (generation !== loadGeneration) {
    results.forEach(result => result.session?.release())
    return
  }
  const next = { historical: null, current: null } as Record<'historical' | 'current', SnapshotProjectRenderSession | null>
  const failed = new Set<'historical' | 'current'>()
  for (const result of results) {
    next[result.key] = result.session
    if (!result.session) failed.add(result.key)
  }
  renderSessions.value = next
  failedSides.value = failed
  loadingSides.value = new Set()
}

watch(
  () => [props.historical.rootPath, props.current.rootPath, props.historical.completeness, props.current.completeness],
  () => void loadRenderSessions(),
  { immediate: true },
)
onBeforeUnmount(() => {
  loadGeneration += 1
  releaseSessions()
})

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}
</script>

<style scoped>
.snapshot-card-diff-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.snapshot-card-diff-editor.is-layout-vertical {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
}
.snapshot-card-diff-editor.is-layout-historical,
.snapshot-card-diff-editor.is-layout-current {
  grid-template-columns: minmax(0, 1fr);
}
.snapshot-card-diff-editor__side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.snapshot-card-diff-editor__side + .snapshot-card-diff-editor__side {
  border-left: var(--oc-border-width) solid var(--oc-border-default);
}
.snapshot-card-diff-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-2) var(--oc-space-3);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}
.snapshot-card-diff-editor__header strong { color: var(--oc-fg-default); }

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-historical :deep(.card-design-editor) {
  --card-editor-right-sidebar-visible-width: 0px !important;
  --card-editor-right-sidebar-edge-inset: 0px !important;
}

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-historical :deep(.card-design-editor__sidebar--right),
.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-historical :deep(.card-design-editor__resizebar--vertical:last-of-type) {
  display: none;
}

.snapshot-card-diff-editor__side :deep(.card-design-editor__sidebar--left > .card-design-editor__resizebar),
.snapshot-card-diff-editor__side :deep(.card-design-editor__sidebar--left > .card-design-editor__sidebar-panel:last-child) {
  display: none;
}

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor) {
  --card-editor-left-sidebar-visible-width: 0px !important;
  --card-editor-left-sidebar-edge-inset: 0px !important;
}

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor__sidebar--left),
.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor__resizebar--vertical:first-of-type) {
  display: none;
}

/* Keep the original Card Designer grid columns when its historical-only left
   panels are hidden from the current comparison side. */
.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor__resizebar--vertical:first-of-type) {
  display: block;
  visibility: hidden;
  grid-column: 2;
}

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor__sidebar--left) {
  display: grid;
  visibility: hidden;
  grid-column: 1;
}

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor__center-spacer) {
  grid-column: 3;
}

.snapshot-card-diff-editor:not(.is-layout-historical):not(.is-layout-current)
  .snapshot-card-diff-editor__side.is-side-current :deep(.card-design-editor__sidebar--right) {
  grid-column: 5;
}
</style>
