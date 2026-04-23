<template>
  <div
    class="oc-toolbar"
    :class="toolbarClass"
    :style="toolbarStyle"
    role="toolbar"
    :aria-orientation="resolvedOrientation"
    :aria-label="ariaLabel"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'

type ToolbarKind = 'menu' | 'sidebar' | 'panel'
type ToolbarOrientation = 'horizontal' | 'vertical'
type ToolbarAlign = 'start' | 'center' | 'end' | 'stretch'
type ToolbarJustify = 'start' | 'center' | 'end' | 'between'

defineOptions({ name: 'OcToolbar' })

const props = withDefaults(defineProps<{
  kind?: ToolbarKind
  orientation?: ToolbarOrientation
  ariaLabel?: string
  align?: ToolbarAlign
  justify?: ToolbarJustify
  gap?: string
  padding?: string
  grow?: boolean
  shrink?: boolean
  fill?: boolean
}>(), {
  kind: 'panel',
  orientation: undefined,
  ariaLabel: undefined,
  align: undefined,
  justify: undefined,
  gap: undefined,
  padding: undefined,
  grow: false,
  shrink: true,
  fill: false,
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
  props.align ? `oc-toolbar--align-${props.align}` : null,
  props.justify ? `oc-toolbar--justify-${props.justify}` : null,
  {
    'is-grow': props.grow,
    'is-no-shrink': !props.shrink,
    'is-fill': props.fill,
  },
])

const toolbarStyle = computed<CSSProperties>(() => ({
  ...(props.gap ? { '--oc-toolbar-gap': props.gap } : {}),
  ...(props.padding ? { '--oc-toolbar-padding': props.padding } : {}),
}))
</script>

<style scoped>
.oc-toolbar {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--oc-toolbar-gap, 0);
  padding: var(--oc-toolbar-padding, 0);
}

.oc-toolbar--horizontal {
  flex-direction: row;
}

.oc-toolbar--vertical {
  flex-direction: column;
}

.oc-toolbar--menu {
  --oc-toolbar-gap: 2px;
}

.oc-toolbar--sidebar {
  width: 100%;
  --oc-toolbar-gap: 0;
}

.oc-toolbar--panel {
  --oc-toolbar-gap: var(--oc-space-1);
}

.oc-toolbar--align-start {
  align-items: flex-start;
}

.oc-toolbar--align-center {
  align-items: center;
}

.oc-toolbar--align-end {
  align-items: flex-end;
}

.oc-toolbar--align-stretch {
  align-items: stretch;
}

.oc-toolbar--justify-start {
  justify-content: flex-start;
}

.oc-toolbar--justify-center {
  justify-content: center;
}

.oc-toolbar--justify-end {
  justify-content: flex-end;
}

.oc-toolbar--justify-between {
  justify-content: space-between;
}

.oc-toolbar.is-grow {
  flex: 1;
}

.oc-toolbar.is-no-shrink {
  flex-shrink: 0;
}

.oc-toolbar.is-fill {
  width: 100%;
}
</style>
