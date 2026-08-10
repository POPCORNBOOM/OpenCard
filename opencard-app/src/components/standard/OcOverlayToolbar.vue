<template>
  <OcCard class="oc-overlay-toolbar" :class="`oc-overlay-toolbar--${orientation}`"
    variant="glass" role="toolbar" :aria-label="label">
    <div class="oc-overlay-toolbar__items">
      <slot />
    </div>
  </OcCard>
</template>

<script setup lang="ts">
import OcCard from './OcCard.vue'

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
  pointer-events: auto;
}

.oc-overlay-toolbar__items {
  display: flex;
  align-items: center;
  gap: var(--oc-space-1);
}

.oc-overlay-toolbar--horizontal .oc-overlay-toolbar__items {
  flex-direction: row;
}

.oc-overlay-toolbar--vertical .oc-overlay-toolbar__items {
  flex-direction: column;
}
</style>
