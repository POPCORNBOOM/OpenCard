<template>
  <span class="oc-chip" :class="chipClass">
    <slot name="icon">
      <OcIcon
        v-if="props.icon"
        class="oc-chip__icon"
        :name="props.icon"
        :tone="props.iconTone"
        size="sm"
      />
    </slot>
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IconResolvable, IconTone } from '../../shared/ui/icon/iconRegistry'
import { OcIcon } from '../../shared/ui/primitives'

type ChipTone = 'default' | 'info'
type ChipSize = 'sm' | 'md'
type ChipDimension = 'none' | 'sm' | 'md' | 'lg' | 'full'

defineOptions({ name: 'OcChip' })

const props = withDefaults(defineProps<{
  tone?: ChipTone
  size?: ChipSize
  truncate?: boolean
  maxWidth?: ChipDimension
  icon?: IconResolvable
  iconTone?: IconTone
}>(), {
  tone: 'default',
  size: 'sm',
  truncate: false,
  maxWidth: 'none',
  icon: undefined,
  iconTone: 'default',
})

const chipClass = computed(() => [
  `oc-chip--tone-${props.tone}`,
  `oc-chip--size-${props.size}`,
  `oc-chip--max-width-${props.maxWidth}`,
  { 'is-truncate': props.truncate },
])
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

.oc-chip__icon {
  flex-shrink: 0;
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

.oc-chip--max-width-none {
  max-width: none;
}

.oc-chip--max-width-sm {
  max-width: 120px;
}

.oc-chip--max-width-md {
  max-width: 180px;
}

.oc-chip--max-width-lg {
  max-width: 240px;
}

.oc-chip--max-width-full {
  max-width: 100%;
}

.oc-chip.is-truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
