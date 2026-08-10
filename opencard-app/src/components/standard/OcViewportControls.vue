<!-- Shared viewport zoom controls; interaction semantics remain owned by the parent viewport. -->
<template>
  <div
    class="oc-viewport-controls"
    :class="[
      `oc-viewport-controls--${props.orientation}`,
      { 'oc-viewport-controls--embedded': props.embedded },
    ]"
    :aria-label="props.ariaLabel"
  >
    <OcButton
      icon-only
      :size="props.buttonSize"
      icon="tool.zoom-out"
      :icon-size="props.iconSize"
      data-tooltip="缩小"
      aria-label="缩小"
      @click="emit('zoom-out')"
    />
    <OcButton
      icon-only
      :size="props.buttonSize"
      icon="tool.fit-screen"
      :icon-size="props.iconSize"
      data-tooltip="适应窗口"
      aria-label="适应窗口"
      @click="emit('reset')"
    />
    <OcText class="oc-viewport-controls__scale" tone="muted">
      {{ props.scaleLabel }}
    </OcText>
    <OcButton
      icon-only
      :size="props.buttonSize"
      icon="tool.zoom-in"
      :icon-size="props.iconSize"
      data-tooltip="放大"
      aria-label="放大"
      @click="emit('zoom-in')"
    />
  </div>
</template>

<script setup lang="ts">
import OcButton from '../base/OcButton.vue'
import type { OcIconSize } from '../base/OcIcon.vue'
import OcText from '../base/OcText.vue'

const props = withDefaults(defineProps<{
  scaleLabel: string
  ariaLabel?: string
  orientation?: 'horizontal' | 'vertical'
  embedded?: boolean
  buttonSize?: 'sm' | 'md' | 'lg'
  iconSize?: OcIconSize
}>(), {
  ariaLabel: '画布缩放控制',
  orientation: 'horizontal',
  embedded: false,
  buttonSize: 'sm',
  iconSize: undefined,
})

const emit = defineEmits<{
  'zoom-out': []
  reset: []
  'zoom-in': []
}>()
</script>

<style scoped>
.oc-viewport-controls {
  display: flex;
  align-items: center;
  gap: var(--oc-space-1);
  min-height: var(--oc-size-md);
  padding: 3px;
  border: 1px solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-glass);
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
  box-shadow: var(--oc-shadow-md);
}

.oc-viewport-controls__scale {
  width: 50px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.oc-viewport-controls--vertical {
  flex-direction: column;
  min-height: 0;
}

.oc-viewport-controls--vertical .oc-viewport-controls__scale {
  flex: 0 0 auto;
  width: var(--oc-size-sm);
  min-height: var(--oc-size-sm);
  display: inline-grid;
  place-items: center;
  font-size: var(--oc-text-xs);
  line-height: 1;
  white-space: nowrap;
  writing-mode: vertical-rl;
  text-orientation: sideways;
}

.oc-viewport-controls--embedded {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  backdrop-filter: none;
  box-shadow: none;
}
</style>
