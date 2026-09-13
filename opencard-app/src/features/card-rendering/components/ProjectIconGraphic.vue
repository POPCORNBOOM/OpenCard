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
  type ProjectIconDimensionReader,
} from '../../workspace/services/projectIconCatalog'
import { readProjectIconSize } from '../../workspace/services/projectIconDimensionResolver'

const props = withDefaults(defineProps<{
  entry: ProjectIconCatalogEntry
  mode?: 'inline' | 'block'
  fit?: ProjectIconBlockFit
  /** Reads the icon's size, which is what asks for it and what re-renders this graphic. */
  readDimensions?: ProjectIconDimensionReader
}>(), {
  mode: 'inline',
  fit: 'contain',
})

const inlineStyle = computed(() => createProjectIconStyle(props.entry, props.readDimensions ?? readProjectIconSize))
const blockStyle = computed(() => createProjectIconBlockStyle(props.entry, props.fit, props.readDimensions ?? readProjectIconSize))
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
