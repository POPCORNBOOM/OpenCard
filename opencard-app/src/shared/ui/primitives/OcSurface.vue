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
  border-radius: 2px;
}

.oc-surface--radius-md {
  border-radius: 6px;
}

.oc-surface--radius-lg {
  border-radius: 10px;
}

.oc-surface--shadow-none {
  box-shadow: none;
}

.oc-surface--shadow-sm {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
}

.oc-surface--shadow-md {
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28);
}

.oc-surface--shadow-overlay {
  box-shadow: var(--oc-shadow-overlay);
}
</style>

