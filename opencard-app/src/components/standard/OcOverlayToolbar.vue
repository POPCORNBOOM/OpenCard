<template>
  <div class="oc-overlay-toolbar" :class="`oc-overlay-toolbar--${orientation}`"
    role="toolbar" :aria-label="label">
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  orientation?: 'horizontal' | 'vertical'
  label?: string
}>(), {
  orientation: 'horizontal',
  label: undefined,
})
</script>

<style scoped>
.oc-overlay-toolbar {
  --oc-overlay-toolbar-item-gap: var(--oc-space-1);

  display: flex;
  align-items: center;
  gap: var(--oc-overlay-toolbar-item-gap);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-glass);
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
  box-shadow: var(--oc-shadow-md);
  pointer-events: auto;
}

.oc-overlay-toolbar--horizontal {
  flex-direction: row;
  padding-block: var(--oc-space-2);
  padding-inline: var(--oc-space-1);
}

.oc-overlay-toolbar--vertical {
  flex-direction: column;
  padding-block: var(--oc-space-1);
  padding-inline: var(--oc-space-2);
}
</style>
