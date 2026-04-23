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

type OverlayInsetSemantic = 'none' | 'compact' | 'default' | 'workspace'
type OverlayInset = OverlayInsetSemantic | (string & {})

const OVERLAY_INSET_PRESETS: Record<OverlayInsetSemantic, string> = {
  none: '0',
  compact: 'var(--oc-space-1)',
  default: 'var(--oc-space-2)',
  workspace: 'var(--card-editor-overlay-inset-y, 20px) var(--card-editor-overlay-inset-x, 24px)',
}

const props = withDefaults(defineProps<{
  as?: string
  visible?: boolean
  inset?: OverlayInset
  interactive?: boolean
}>(), {
  as: 'div',
  visible: true,
  inset: 'none',
  interactive: true,
})

const resolvedInset = computed(() => OVERLAY_INSET_PRESETS[props.inset as OverlayInsetSemantic] ?? props.inset)

const overlayLayerStyle = computed(() => ({
  inset: resolvedInset.value,
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
