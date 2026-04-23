<template>
  <span class="oc-chip" :class="chipClass" :style="chipStyle">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

type ChipTone = 'default' | 'info'
type ChipSize = 'sm' | 'md'

defineOptions({ name: 'OcChip' })

const props = withDefaults(defineProps<{
  tone?: ChipTone
  size?: ChipSize
  truncate?: boolean
  maxWidth?: string
}>(), {
  tone: 'default',
  size: 'sm',
  truncate: false,
  maxWidth: undefined,
})

const chipClass = computed(() => [
  `oc-chip--tone-${props.tone}`,
  `oc-chip--size-${props.size}`,
  { 'is-truncate': props.truncate },
])

const chipStyle = computed<CSSProperties>(() => ({
  ...(props.maxWidth ? { maxWidth: props.maxWidth } : {}),
}))
</script>

<style scoped>
.oc-chip {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
  padding: 0 8px;
  border-radius: var(--oc-radius-pill);
  border: 1px solid var(--oc-border-subtle);
  background: var(--oc-bg-panel);
  color: var(--oc-text-primary);
}

.oc-chip--size-sm {
  min-height: 18px;
  font-size: var(--oc-label-size);
}

.oc-chip--size-md {
  min-height: 22px;
  font-size: var(--oc-body-size);
}

.oc-chip--tone-info {
  color: var(--oc-text-info);
}

.oc-chip.is-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
