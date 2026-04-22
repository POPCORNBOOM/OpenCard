<template>
  <div
    class="oc-toolbar"
    :class="toolbarClass"
    role="toolbar"
    :aria-orientation="resolvedOrientation"
    :aria-label="ariaLabel"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type ToolbarKind = 'menu' | 'sidebar' | 'panel'
type ToolbarOrientation = 'horizontal' | 'vertical'

defineOptions({ name: 'OcToolbar' })

const props = withDefaults(defineProps<{
  kind?: ToolbarKind
  orientation?: ToolbarOrientation
  ariaLabel?: string
}>(), {
  kind: 'panel',
  orientation: undefined,
  ariaLabel: undefined,
})

const resolvedOrientation = computed<ToolbarOrientation>(() => {
  if (props.orientation) {
    return props.orientation
  }

  return props.kind === 'sidebar' ? 'vertical' : 'horizontal'
})

const toolbarClass = computed(() => [
  `oc-toolbar--${props.kind}`,
  `oc-toolbar--${resolvedOrientation.value}`,
])
</script>

<style scoped>
.oc-toolbar {
  min-width: 0;
  display: flex;
  align-items: center;
}

.oc-toolbar--horizontal {
  flex-direction: row;
}

.oc-toolbar--vertical {
  flex-direction: column;
}

.oc-toolbar--menu {
  gap: 2px;
}

.oc-toolbar--sidebar {
  width: 100%;
  gap: 0;
}

.oc-toolbar--panel {
  gap: var(--oc-space-1);
}
</style>
