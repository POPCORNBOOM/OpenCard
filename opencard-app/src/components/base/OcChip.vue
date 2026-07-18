<!-- Base 标签胶囊：轻量标记元素，用于状态、类型等分类标注。 -->

<template>
  <span class="oc-chip" :class="chipClass">
    <OcIcon v-if="icon" :name="icon" />
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from './OcIcon.vue'

interface Props {
  tone?: 'default' | 'accent' | 'muted'
  size?: 'sm' | 'md'
  icon?: IconToken
  truncate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  tone: 'default',
  size: 'sm',
  truncate: false
})

defineOptions({ name: 'OcChip' })

const chipClass = computed(() => [
  `oc-chip--${props.size}`,
  `oc-chip--${props.tone}`,
  {
    'oc-chip--truncate': props.truncate
  }
])
</script>

<style scoped>
.oc-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
  padding: 0 var(--oc-space-2);
  border-radius: var(--oc-radius-full);
  border: 1px solid var(--oc-border-muted);
  background: var(--oc-bg-surface);
  font-size: var(--oc-text-sm);
  color: var(--oc-fg-default);
}

.oc-chip--sm {
  min-height: 18px;
}

.oc-chip--md {
  min-height: 22px;
  font-size: var(--oc-text-base);
}

.oc-chip--accent {
  color: var(--oc-fg-accent);
  border-color: var(--oc-border-accent);
}

.oc-chip--muted {
  color: var(--oc-fg-muted);
}

.oc-chip--truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 160px;
}
</style>
