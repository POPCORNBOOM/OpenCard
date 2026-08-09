<template>
  <section class="snapshot-custom-block-package-diff-editor">
    <section v-for="side in sides" :key="side.key" class="snapshot-custom-block-package-diff-editor__side">
      <header class="snapshot-custom-block-package-diff-editor__header">
        <strong>{{ side.marker }}</strong>
        <span>{{ side.label }}</span>
      </header>
      <OcEmpty v-if="!side.snapshot.exists">{{ t('versioning.diff.missing') }}</OcEmpty>
      <CustomBlockPackageEditor
        v-else
        :file-path="snapshotPath(side.snapshot)"
        :file-name="fileName"
        :resource-root-path="side.snapshot.rootPath"
        access="observe-only"
      />
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import OcEmpty from '../../../components/base/OcEmpty.vue'
import CustomBlockPackageEditor from '../../../components/editors/CustomBlockPackageEditor.vue'
import type { SnapshotDescriptorDto } from '../model/versioning'

const props = defineProps<{
  historical: SnapshotDescriptorDto
  current: SnapshotDescriptorDto
  fileName: string
}>()
const { t } = useI18n()
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
.snapshot-custom-block-package-diff-editor {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.snapshot-custom-block-package-diff-editor__side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.snapshot-custom-block-package-diff-editor__side + .snapshot-custom-block-package-diff-editor__side {
  border-left: var(--oc-border-width) solid var(--oc-border-default);
}
.snapshot-custom-block-package-diff-editor__header {
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  padding: var(--oc-space-2) var(--oc-space-3);
  border-bottom: var(--oc-border-width) solid var(--oc-border-muted);
  background: var(--oc-bg-raised);
  color: var(--oc-fg-muted);
  font-size: var(--oc-text-sm);
}
.snapshot-custom-block-package-diff-editor__header strong { color: var(--oc-fg-default); }
</style>
