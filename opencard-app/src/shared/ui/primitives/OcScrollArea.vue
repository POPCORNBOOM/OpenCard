<template>
  <component
    :is="as"
    class="oc-scroll-area"
    :class="scrollClass"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ScrollAxis = 'x' | 'y' | 'both'

defineOptions({ name: 'OcScrollArea' })

const props = withDefaults(defineProps<{
  as?: string
  axis?: ScrollAxis
}>(), {
  as: 'div',
  axis: 'y',
})

const scrollClass = computed(() => `oc-scroll-area--${props.axis}`)
</script>

<style scoped>
.oc-scroll-area {
  min-width: 0;
  min-height: 0;
}

.oc-scroll-area--x {
  overflow-x: auto;
  overflow-y: hidden;
}

.oc-scroll-area--y {
  overflow-y: auto;
  overflow-x: hidden;
}

.oc-scroll-area--both {
  overflow: auto;
}
</style>

