<template>
  <section class="snapshot-custom-block-registry-diff-editor">
    <section v-for="side in sides" :key="side.key" class="snapshot-custom-block-registry-diff-editor__side">
      <header class="snapshot-custom-block-registry-diff-editor__header">
        <strong>{{ side.marker }}</strong>
        <span>{{ side.label }}</span>
      </header>
      <OcEmpty v-if="!side.snapshot.exists">{{ t('versioning.diff.missing') }}</OcEmpty>
      <ProjectCustomBlockRegistryEditor
        v-else
        :file-path="snapshotPath(side.snapshot)"
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
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import ProjectCustomBlockRegistryEditor from '../../../components/editors/ProjectCustomBlockRegistryEditor.vue'
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
const sides = computed(() => [
  {
    key: 'historical' as const,
    marker: 'A',
    label: t('versioning.diff.historical'),
    snapshot: props.historical,
    content: props.comparison.historicalContent,
    comparisonContent: props.comparison.currentContent,
  },
  {
    key: 'current' as const,
    marker: 'B',
    label: t('versioning.diff.current'),
    snapshot: props.current,
    content: props.comparison.currentContent,
    comparisonContent: props.comparison.historicalContent,
  },
])

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}
</script>

<style scoped>
.snapshot-custom-block-registry-diff-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.snapshot-custom-block-registry-diff-editor__side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.snapshot-custom-block-registry-diff-editor__side + .snapshot-custom-block-registry-diff-editor__side {
  border-left: var(--oc-border-width) solid var(--oc-border-default);
}
.snapshot-custom-block-registry-diff-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-2) var(--oc-space-3);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}
.snapshot-custom-block-registry-diff-editor__header strong { color: var(--oc-fg-default); }
</style>
