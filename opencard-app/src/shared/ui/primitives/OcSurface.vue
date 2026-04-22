<template>
  <component
    :is="as"
    class="oc-surface"
    :class="surfaceClass"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type OcSurfaceVariant = 'panel' | 'elevated' | 'input' | 'floating' | 'transparent'
type OcSurfaceRadius = 'none' | 'sm' | 'md' | 'lg'
type OcSurfaceShadow = 'none' | 'sm' | 'md' | 'overlay'

defineOptions({ name: 'OcSurface' })

const props = withDefaults(defineProps<{
  as?: string
  variant?: OcSurfaceVariant
  radius?: OcSurfaceRadius
  shadow?: OcSurfaceShadow
  bordered?: boolean
}>(), {
  as: 'div',
  variant: 'panel',
  radius: 'sm',
  shadow: 'none',
  bordered: false,
})

const surfaceClass = computed(() => [
  `oc-surface--${props.variant}`,
  `oc-surface--radius-${props.radius}`,
  `oc-surface--shadow-${props.shadow}`,
  { 'is-bordered': props.bordered },
])
</script>

<style scoped>
.oc-surface {
  min-width: 0;
  min-height: 0;
}

.oc-surface--panel {
  background: var(--oc-bg-panel);
}

.oc-surface--elevated {
  background: var(--oc-bg-elevated);
}

.oc-surface--input {
  background: var(--oc-bg-input);
}

.oc-surface--floating {
  background: var(--oc-bg-panel);
}

.oc-surface--transparent {
  background: transparent;
}

.oc-surface.is-bordered {
  border: 1px solid var(--oc-border-surface);
}

.oc-surface--radius-none {
  border-radius: 0;
}

.oc-surface--radius-sm {
  border-radius: var(--oc-radius-sm);
}

.oc-surface--radius-md {
  border-radius: var(--oc-radius-md);
}

.oc-surface--radius-lg {
  border-radius: var(--oc-radius-lg);
}

.oc-surface--shadow-none {
  box-shadow: none;
}

.oc-surface--shadow-sm {
  box-shadow: var(--oc-shadow-sm);
}

.oc-surface--shadow-md {
  box-shadow: var(--oc-shadow-md);
}

.oc-surface--shadow-overlay {
  box-shadow: var(--oc-shadow-overlay);
}
</style>
