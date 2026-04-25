<template>
  <component :is="as" class="oc-overlay">
    <div class="oc-overlay__base">
      <slot />
    </div>
    <div
      v-if="visible"
      class="oc-overlay__layer"
      :class="{ 'is-layer-interactive': interactive }"
      :style="overlayLayerStyle"
    >
      <slot name="overlay" />
    </div>
  </component>
</template>

<script setup lang="ts">
/**
 * 在基底内容之上叠加展示层，默认仅让叠加内容本体可交互，空白区域保持穿透。
 */
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
  /** 根元素标签。 */
  as?: string
  /** 控制叠加层显隐。 */
  visible?: boolean
  /** 叠加层 inset 预设或自定义值。 */
  inset?: OverlayInset
  /** 是否让整层（包含空白区）也拦截交互。 */
  interactive?: boolean
}>(), {
  as: 'div',
  visible: true,
  inset: 'none',
  interactive: false,
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
  pointer-events: none;
}

.oc-overlay__layer > * {
  pointer-events: auto;
}

.oc-overlay__layer.is-layer-interactive {
  pointer-events: auto;
}
</style>
