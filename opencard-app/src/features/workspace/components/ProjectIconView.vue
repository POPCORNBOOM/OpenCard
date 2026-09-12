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
  type ProjectIconDimensionRequest,
} from '../services/projectIconCatalog'
import { resolveProjectIconDimensions } from '../services/projectIconDimensionResolver'

const props = withDefaults(defineProps<{
  entry: ProjectIconCatalogEntry
  mode?: 'inline' | 'preview'
  /** Reports an unmeasured icon, so its size gets resolved and this view re-renders. */
  resolveDimensions?: ProjectIconDimensionRequest
}>(), { mode: 'inline' })
const style = computed(() => {
  void props.entry.imageWidth
  void props.entry.imageHeight
  const request = props.resolveDimensions ?? resolveProjectIconDimensions
  return props.mode === 'preview'
    ? createProjectIconPreviewStyle(props.entry, request)
    : createProjectIconStyle(props.entry, request)
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
