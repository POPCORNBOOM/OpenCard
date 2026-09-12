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
  type ProjectIconDimensionRequest,
} from '../../workspace/services/projectIconCatalog'
import { resolveProjectIconDimensions } from '../../workspace/services/projectIconDimensionResolver'

const props = withDefaults(defineProps<{
  entry: ProjectIconCatalogEntry
  mode?: 'inline' | 'block'
  fit?: ProjectIconBlockFit
  /** Reports an unmeasured icon, so its size gets resolved and this graphic re-renders. */
  resolveDimensions?: ProjectIconDimensionRequest
}>(), {
  mode: 'inline',
  fit: 'contain',
})

const requestDimensions = (entry: ProjectIconCatalogEntry): void => {
  (props.resolveDimensions ?? resolveProjectIconDimensions)(entry)
}

/** Reading the entry's size here is what makes a size resolved later invalidate this style. */
const inlineStyle = computed(() => {
  void props.entry.imageWidth
  void props.entry.imageHeight
  return createProjectIconStyle(props.entry, requestDimensions)
})
const blockStyle = computed(() => {
  void props.entry.imageWidth
  void props.entry.imageHeight
  return createProjectIconBlockStyle(props.entry, props.fit, requestDimensions)
})
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
