<template>
  <OcBox as="div" inline class="oc-toolbar" :class="toolbarClass" role="toolbar" :aria-orientation="resolvedOrientation"
    :aria-label="ariaLabel">
    <slot />
  </OcBox>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OcBox } from '../../shared/ui/primitives'

type ToolbarKind = 'menu' | 'sidebar' | 'panel'
type ToolbarOrientation = 'horizontal' | 'vertical'
type ToolbarAlign = 'start' | 'center' | 'end' | 'stretch'
type ToolbarJustify = 'start' | 'center' | 'end' | 'between'
type ToolbarSpacing = 'none' | 'tight' | 'normal' | 'loose'
type ToolbarInset = 'none' | 'compact' | 'comfortable'

defineOptions({ name: 'OcToolbar' })

const props = withDefaults(defineProps<{
  kind?: ToolbarKind
  orientation?: ToolbarOrientation
  ariaLabel?: string
  align?: ToolbarAlign
  justify?: ToolbarJustify
  spacing?: ToolbarSpacing
  inset?: ToolbarInset
  grow?: boolean
  shrink?: boolean
  fill?: boolean
}>(), {
  kind: 'panel',
  orientation: undefined,
  ariaLabel: undefined,
  align: undefined,
  justify: undefined,
  spacing: undefined,
  inset: undefined,
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

const resolvedSpacing = computed<ToolbarSpacing>(() => {
  if (props.spacing) {
    return props.spacing
  }

  if (props.kind === 'menu') {
    return 'tight'
  }

  if (props.kind === 'sidebar') {
    return 'none'
  }

  return 'tight'
})

const resolvedInset = computed<ToolbarInset>(() => {
  if (props.inset) {
    return props.inset
  }

  return props.kind === 'sidebar' ? 'comfortable' : 'none'
})

const toolbarClass = computed(() => [
  `oc-toolbar--${props.kind}`,
  `oc-toolbar--${resolvedOrientation.value}`,
  `oc-toolbar--spacing-${resolvedSpacing.value}`,
  `oc-toolbar--inset-${resolvedInset.value}`,
  props.align ? `oc-toolbar--align-${props.align}` : null,
  props.justify ? `oc-toolbar--justify-${props.justify}` : null,
  {
    'is-grow': props.grow,
    'is-no-shrink': !props.shrink,
    'is-fill': props.fill,
  },
])
</script>

<style scoped>
.oc-toolbar {
  min-width: 0;
  gap: 0;
  padding: 0;
}

.oc-toolbar--horizontal {
  flex-direction: row;
}

.oc-toolbar--vertical {
  flex-direction: column;
}

.oc-toolbar--menu {
  /* semantic kind hook */
}

.oc-toolbar--sidebar {
  width: 100%;
}

.oc-toolbar--panel {
  /* semantic kind hook */
}

.oc-toolbar--spacing-none {
  gap: 0;
}

.oc-toolbar--spacing-tight {
  gap: var(--oc-space-1);
}

.oc-toolbar--spacing-normal {
  gap: var(--oc-space-2);
}

.oc-toolbar--spacing-loose {
  gap: var(--oc-space-3);
}

.oc-toolbar--horizontal.oc-toolbar--inset-none {
  padding: 0;
}

.oc-toolbar--horizontal.oc-toolbar--inset-compact {
  padding: 0 var(--oc-space-1);
}

.oc-toolbar--horizontal.oc-toolbar--inset-comfortable {
  padding: 0 var(--oc-space-3);
}

.oc-toolbar--vertical.oc-toolbar--inset-none {
  padding: 0;
}

.oc-toolbar--vertical.oc-toolbar--inset-compact {
  padding: var(--oc-space-1) 0;
}

.oc-toolbar--vertical.oc-toolbar--inset-comfortable {
  padding: var(--oc-space-3) 0;
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
