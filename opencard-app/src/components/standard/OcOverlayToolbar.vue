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
  display: flex;
  align-items: center;
  gap: var(--oc-space-1);
  padding: var(--oc-space-1);
  border: var(--oc-border-width) solid var(--oc-border-muted);
  border-radius: var(--oc-radius-md);
  background: var(--oc-bg-glass);
  backdrop-filter: blur(var(--oc-bg-glass-blur)) saturate(var(--oc-bg-glass-saturate));
  box-shadow: var(--oc-shadow-md);
  pointer-events: auto;
}

.oc-overlay-toolbar--horizontal { flex-direction: row; }
.oc-overlay-toolbar--vertical { flex-direction: column; }
</style>
