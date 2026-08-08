<template>
  <section class="snapshot-card-diff-editor">
    <section v-for="side in sides" :key="side.key" class="snapshot-card-diff-editor__side">
      <header class="snapshot-card-diff-editor__header">
        <strong>{{ side.marker }}</strong>
        <span>{{ side.label }}</span>
      </header>
      <OcEmpty v-if="!side.snapshot.exists">{{ t('versioning.diff.missing') }}</OcEmpty>
      <CardDesignEditor
        v-else
        :file-path="snapshotPath(side.snapshot)"
        :file-name="fileName"
        :resource-root-path="side.snapshot.rootPath"
        :model-value="side.content"
        :card-designer-view="view"
        :viewport-transform="viewportTransform"
        :theme-id="themeId"
        :theme-overrides="themeOverrides"
        access="observe-only"
        @update-card-designer-view="view = $event"
        @update-viewport-transform="viewportTransform = $event"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import CardDesignEditor from '../../card-designer/CardDesignEditor.vue'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import type { CardDesignerViewState, EditorViewportTransform } from '../../editor-runtime/model/editorUiState'
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
const view = ref<CardDesignerViewState>({
  activeFace: 'front',
  clipToFace: true,
  alignmentSnappingEnabled: true,
  selectedInstanceId: null,
})
const viewportTransform = ref<EditorViewportTransform>({ x: 0, y: 0, scale: 1 })
const sides = computed(() => [
  { key: 'historical', marker: 'A', label: t('versioning.diff.historical'), snapshot: props.historical, content: props.comparison.historicalContent },
  { key: 'current', marker: 'B', label: t('versioning.diff.current'), snapshot: props.current, content: props.comparison.currentContent },
])

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
</style>
