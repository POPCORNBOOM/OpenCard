<template>
  <span
    v-if="mode === 'inline'"
    class="project-icon-graphic project-icon-graphic--inline oc-project-icon"
    :style="inlineStyle"
    role="img"
    :aria-label="entry.name"
  />
  <span
    v-else
    class="project-icon-graphic project-icon-graphic--block"
    role="img"
    :aria-label="entry.name"
  >
    <span
      class="project-icon-graphic__block-image oc-project-icon"
      :style="blockStyle"
      aria-hidden="true"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  createProjectIconBlockStyle,
  createProjectIconStyle,
  type ProjectIconBlockFit,
  type ProjectIconCatalogEntry,
} from '../../workspace/services/projectIconCatalog'

const props = withDefaults(defineProps<{
  entry: ProjectIconCatalogEntry
  mode?: 'inline' | 'block'
  fit?: ProjectIconBlockFit
}>(), {
  mode: 'inline',
  fit: 'contain',
})

const inlineStyle = computed(() => createProjectIconStyle(props.entry))
const blockStyle = computed(() => createProjectIconBlockStyle(props.entry, props.fit))
</script>

<style scoped>
.project-icon-graphic--inline {
  display: inline-block;
  vertical-align: text-bottom;
}

.project-icon-graphic--block {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  place-items: center;
  overflow: hidden;
}

.project-icon-graphic__block-image {
  display: block;
  width: var(--oc-project-icon-display-width);
  height: var(--oc-project-icon-display-height);
}
</style>
