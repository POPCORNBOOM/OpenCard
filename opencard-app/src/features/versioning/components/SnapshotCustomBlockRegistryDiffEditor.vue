<template>
  <section class="snapshot-custom-block-registry-diff-editor">
    <ProjectCustomBlockRegistryEditor
      :file-path="snapshotPath(props.current)"
      :file-name="fileName"
      :resource-root-path="props.current.rootPath"
      :comparison-resource-root-path="props.historical.rootPath"
      :model-value="comparison.currentContent"
      :comparison-content="comparison.historicalContent"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
      access="observe-only"
    />
  </section>
</template>

<script setup lang="ts">
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
function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}
</script>

<style scoped>
.snapshot-custom-block-registry-diff-editor {
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
