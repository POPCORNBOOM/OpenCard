<template>
  <div class="oc-split-pane" :class="splitPaneClass">
    <div class="oc-split-pane__pane oc-split-pane__pane--primary" :style="primaryPaneStyle">
      <slot name="primary" />
    </div>
    <slot name="resizer" />
    <div class="oc-split-pane__pane oc-split-pane__pane--secondary" :style="secondaryPaneStyle">
      <slot name="secondary" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type SplitPaneOrientation = 'horizontal' | 'vertical'
type FixedPane = 'primary' | 'secondary'
type SplitPaneRadius = 'none' | 'sm' | 'md' | 'lg'
type SplitPaneSizePreset = 'sm' | 'md' | 'lg' | 'workspace'
type SplitPaneSize = SplitPaneSizePreset | (string & {})

const SPLIT_PANE_FIXED_SIZE_PRESETS: Record<SplitPaneSizePreset, string> = {
  sm: 'var(--oc-split-pane-fixed-sm, 220px)',
  md: 'var(--oc-split-pane-fixed-md, 320px)',
  lg: 'var(--oc-split-pane-fixed-lg, 420px)',
  workspace: 'var(--oc-split-pane-fixed-workspace, var(--card-editor-tree-panel-height, 320px))',
}

const SPLIT_PANE_MIN_SIZE_PRESETS: Record<SplitPaneSizePreset, string> = {
  sm: 'var(--oc-split-pane-min-sm, 140px)',
  md: 'var(--oc-split-pane-min-md, 180px)',
  lg: 'var(--oc-split-pane-min-lg, 220px)',
  workspace: 'var(--oc-split-pane-min-workspace, var(--card-editor-min-property-panel-height, 180px))',
}

defineOptions({ name: 'OcSplitPane' })

const props = withDefaults(defineProps<{
  orientation?: SplitPaneOrientation
  fixedPane?: FixedPane
  fixedSize?: SplitPaneSize
  primaryMinSize?: SplitPaneSize
  secondaryMinSize?: SplitPaneSize
  clip?: boolean
  radius?: SplitPaneRadius
}>(), {
  orientation: 'horizontal',
  fixedPane: 'secondary',
  fixedSize: undefined,
  primaryMinSize: undefined,
  secondaryMinSize: undefined,
  clip: false,
  radius: 'none',
})

const splitPaneClass = computed(() => [
  `oc-split-pane--${props.orientation}`,
  `oc-split-pane--fixed-${props.fixedPane}`,
  `oc-split-pane--radius-${props.radius}`,
  { 'is-clip': props.clip },
])

function resolveSplitPaneSize(
  size: SplitPaneSize | undefined,
  presets: Record<SplitPaneSizePreset, string>,
): string | undefined {
  if (size === undefined) {
    return undefined
  }

  return presets[size as SplitPaneSizePreset] ?? size
}

const resolvedFixedSize = computed(() => resolveSplitPaneSize(props.fixedSize, SPLIT_PANE_FIXED_SIZE_PRESETS))
const resolvedPrimaryMinSize = computed(() => resolveSplitPaneSize(props.primaryMinSize, SPLIT_PANE_MIN_SIZE_PRESETS))
const resolvedSecondaryMinSize = computed(() => resolveSplitPaneSize(props.secondaryMinSize, SPLIT_PANE_MIN_SIZE_PRESETS))

function resolveFixedPaneStyle(targetPane: FixedPane, fixedSize?: string, minSize?: string) {
  if (props.fixedPane !== targetPane) {
    return {
      minWidth: props.orientation === 'horizontal' ? minSize : undefined,
      minHeight: props.orientation === 'vertical' ? minSize : undefined,
    }
  }

  if (!fixedSize) {
    return {
      minWidth: props.orientation === 'horizontal' ? minSize : undefined,
      minHeight: props.orientation === 'vertical' ? minSize : undefined,
    }
  }

  return {
    flexBasis: fixedSize,
    width: props.orientation === 'horizontal' ? fixedSize : undefined,
    height: props.orientation === 'vertical' ? fixedSize : undefined,
    minWidth: props.orientation === 'horizontal' ? minSize : undefined,
    minHeight: props.orientation === 'vertical' ? minSize : undefined,
  }
}

const primaryPaneStyle = computed(() => resolveFixedPaneStyle('primary', resolvedFixedSize.value, resolvedPrimaryMinSize.value))
const secondaryPaneStyle = computed(() => resolveFixedPaneStyle('secondary', resolvedFixedSize.value, resolvedSecondaryMinSize.value))
</script>

<style scoped>
.oc-split-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  width: 100%;
  height: 100%;
}

.oc-split-pane.is-clip {
  overflow: hidden;
}

.oc-split-pane--horizontal {
  flex-direction: row;
}

.oc-split-pane--vertical {
  flex-direction: column;
}

.oc-split-pane--radius-none {
  border-radius: 0;
}

.oc-split-pane--radius-sm {
  border-radius: var(--oc-radius-sm);
}

.oc-split-pane--radius-md {
  border-radius: var(--oc-radius-md);
}

.oc-split-pane--radius-lg {
  border-radius: var(--oc-radius-lg);
}

.oc-split-pane__pane {
  min-width: 0;
  min-height: 0;
}

.oc-split-pane__pane--primary {
  flex: 1 1 auto;
}

.oc-split-pane__pane--secondary {
  flex: 0 0 auto;
}

.oc-split-pane--fixed-primary > .oc-split-pane__pane--primary {
  flex: 0 0 auto;
}

.oc-split-pane--fixed-primary > .oc-split-pane__pane--secondary {
  flex: 1 1 auto;
}
</style>
