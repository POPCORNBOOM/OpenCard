<!-- Shared viewport zoom controls; interaction semantics remain owned by the parent viewport. -->
<template>
  <div class="oc-viewport-controls" :aria-label="props.ariaLabel">
    <OcButton
      icon-only
      size="sm"
      icon="tool.zoom-out"
      title="缩小"
      aria-label="缩小"
      @click="emit('zoom-out')"
    />
    <OcButton
      icon-only
      size="sm"
      icon="tool.fit-screen"
      title="适应窗口"
      aria-label="适应窗口"
      @click="emit('reset')"
    />
    <OcText class="oc-viewport-controls__scale" tone="muted">
      {{ props.scaleLabel }}
    </OcText>
    <OcButton
      icon-only
      size="sm"
      icon="tool.zoom-in"
      title="放大"
      aria-label="放大"
      @click="emit('zoom-in')"
    />
  </div>
</template>

<script setup lang="ts">
import OcButton from '../base/OcButton.vue'
import OcText from '../base/OcText.vue'

const props = withDefaults(defineProps<{
  scaleLabel: string
  ariaLabel?: string
}>(), {
  ariaLabel: '画布缩放控制',
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
</style>
