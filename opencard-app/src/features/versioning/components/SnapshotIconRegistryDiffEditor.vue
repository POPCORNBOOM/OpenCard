<template>
  <section class="snapshot-icon-registry-diff-editor">
    <ProjectIconRegistryFileEditor
      :file-path="snapshotPath(current)"
      :file-name="fileName"
      :resource-root-path="current.rootPath"
      :comparison-resource-root-path="historical.rootPath"
      :model-value="comparison.currentContent"
      :comparison-content="comparison.historicalContent"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
      access="observe-only"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ProjectIconRegistryFileEditor from '../../../components/editors/ProjectIconRegistryFileEditor.vue'
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
const historical = computed(() => props.historical)
const current = computed(() => props.current)

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}
</script>

<style scoped>
.snapshot-icon-registry-diff-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
