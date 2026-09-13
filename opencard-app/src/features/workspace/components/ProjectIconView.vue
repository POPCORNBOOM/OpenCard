<template>
  <span
    class="project-icon-view oc-project-icon"
    :style="style"
    role="img"
    :aria-label="entry.name"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  createProjectIconPreviewStyle,
  createProjectIconStyle,
  type ProjectIconCatalogEntry,
  type ProjectIconDimensionReader,
} from '../services/projectIconCatalog'
import { readProjectIconSize } from '../services/projectIconDimensionResolver'

const props = withDefaults(defineProps<{
  entry: ProjectIconCatalogEntry
  mode?: 'inline' | 'preview'
  /** Reads the icon's size, which is what asks for it and what re-renders this view. */
  readDimensions?: ProjectIconDimensionReader
}>(), { mode: 'inline' })
const style = computed(() => {
  const read = props.readDimensions ?? readProjectIconSize
  return props.mode === 'preview'
    ? createProjectIconPreviewStyle(props.entry, read)
    : createProjectIconStyle(props.entry, read)
})
</script>

<style scoped>
.project-icon-view {
  display: inline-block;
  flex: none;
  background-repeat: no-repeat;
  vertical-align: text-bottom;
}
</style>
