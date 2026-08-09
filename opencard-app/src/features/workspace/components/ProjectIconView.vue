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
} from '../services/projectIconCatalog'

const props = withDefaults(defineProps<{
  entry: ProjectIconCatalogEntry
  mode?: 'inline' | 'preview'
}>(), { mode: 'inline' })
const style = computed(() => props.mode === 'preview'
  ? createProjectIconPreviewStyle(props.entry)
  : createProjectIconStyle(props.entry))
</script>

<style scoped>
.project-icon-view {
  display: inline-block;
  flex: none;
  background-repeat: no-repeat;
  vertical-align: text-bottom;
}
</style>
