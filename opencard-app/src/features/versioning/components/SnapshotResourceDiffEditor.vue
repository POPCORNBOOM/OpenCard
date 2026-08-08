<template>
  <section class="snapshot-resource-diff-editor">
    <section v-for="side in sides" :key="side.key" class="snapshot-resource-diff-editor__side">
      <header class="snapshot-resource-diff-editor__header">
        <strong>{{ side.marker }}</strong>
        <span>{{ side.label }}</span>
      </header>
      <div class="snapshot-resource-diff-editor__content">
        <OcEmpty v-if="!side.snapshot.exists">{{ t('versioning.diff.missing') }}</OcEmpty>
        <ImagePreviewEditor
          v-else-if="kind === 'image'"
          :file-path="snapshotPath(side.snapshot)"
          :file-name="fileName"
          :resource-root-path="side.snapshot.rootPath"
          :viewport-transform="viewportTransform"
          :pixelated="pixelated"
          @update-viewport-transform="viewportTransform = $event"
          @update:pixelated="pixelated = $event"
        />
        <FontPreviewEditor
          v-else
          :file-path="snapshotPath(side.snapshot)"
          :file-name="fileName"
          :resource-root-path="side.snapshot.rootPath"
          :font-preview-text="fontPreviewText"
          @update-font-preview-text="fontPreviewText = $event"
        />
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ImagePreviewEditor from '../../../components/editors/ImagePreviewEditor.vue'
import FontPreviewEditor from '../../../components/editors/FontPreviewEditor.vue'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import type { EditorViewportTransform } from '../../editor-runtime/model/editorUiState'
import type { SnapshotDescriptorDto } from '../model/versioning'

const props = defineProps<{
  historical: SnapshotDescriptorDto
  current: SnapshotDescriptorDto
  kind: 'image' | 'font'
  fileName: string
}>()
const { t } = useI18n()
const viewportTransform = ref<EditorViewportTransform>({ x: 0, y: 0, scale: 1 })
const pixelated = ref(false)
const fontPreviewText = ref(t('fontPreview.sample'))
const sides = computed(() => [
  { key: 'historical', marker: 'A', label: t('versioning.diff.historical'), snapshot: props.historical },
  { key: 'current', marker: 'B', label: t('versioning.diff.current'), snapshot: props.current },
])

function snapshotPath(snapshot: SnapshotDescriptorDto): string {
  const separator = snapshot.rootPath.includes('\\') ? '\\' : '/'
  return `${snapshot.rootPath.replace(/[\\/]+$/, '')}${separator}${snapshot.relativePath.replace(/[\\/]/g, separator)}`
}
</script>

<style scoped>
.snapshot-resource-diff-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.snapshot-resource-diff-editor__side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.snapshot-resource-diff-editor__side + .snapshot-resource-diff-editor__side {
  border-left: var(--oc-border-width) solid var(--oc-border-default);
}

.snapshot-resource-diff-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  min-height: var(--oc-size-md);
  padding: var(--oc-space-2) var(--oc-space-3);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}

.snapshot-resource-diff-editor__header strong {
  color: var(--oc-fg-default);
}

.snapshot-resource-diff-editor__content {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.snapshot-resource-diff-editor__content > * {
  width: 100%;
  height: 100%;
}
</style>
