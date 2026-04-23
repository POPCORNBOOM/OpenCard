<template>
  <component :is="as" class="oc-overlay">
    <div class="oc-overlay__base">
      <slot />
    </div>
    <div
      v-if="visible"
      class="oc-overlay__layer"
      :class="{ 'is-non-interactive': !interactive }"
      :style="overlayLayerStyle"
    >
      <slot name="overlay" />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'OcOverlay' })

const props = withDefaults(defineProps<{
  as?: string
  visible?: boolean
  inset?: string
  interactive?: boolean
}>(), {
  as: 'div',
  visible: true,
  inset: '0',
  interactive: true,
})

const overlayLayerStyle = computed(() => ({
  inset: props.inset,
}))
</script>

<style scoped>
.oc-overlay {
  position: relative;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.oc-overlay__base {
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.oc-overlay__layer {
  position: absolute;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.oc-overlay__layer.is-non-interactive {
  pointer-events: none;
}
</style>
