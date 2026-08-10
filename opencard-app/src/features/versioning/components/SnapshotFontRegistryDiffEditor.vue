<template>
  <section class="snapshot-font-registry-diff-editor">
    <ProjectFontRegistryFileEditor
      :file-path="snapshotPath(current)"
      :file-name="fileName"
      :resource-root-path="current.rootPath"
      :comparison-resource-root-path="historical.rootPath"
      :model-value="comparison.currentContent"
      :comparison-content="comparison.historicalContent"
      :font-preview-text="previewText"
      :theme-id="themeId"
      :theme-overrides="themeOverrides"
      access="observe-only"
      @update-font-preview-text="previewText = $event"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ProjectFontRegistryFileEditor from '../../../components/editors/ProjectFontRegistryFileEditor.vue'
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
const previewText = ref(t('projectConfig.fonts.previewSample'))
const historical = computed(() => props.historical)
const current = computed(() => props.current)

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}
</script>

<style scoped>
.snapshot-font-registry-diff-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
</style>
