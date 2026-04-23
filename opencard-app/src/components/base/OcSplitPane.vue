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

defineOptions({ name: 'OcSplitPane' })

const props = withDefaults(defineProps<{
  orientation?: SplitPaneOrientation
  fixedPane?: FixedPane
  fixedSize?: string
  primaryMinSize?: string
  secondaryMinSize?: string
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

function resolveFixedPaneStyle(targetPane: FixedPane, minSize?: string) {
  if (props.fixedPane !== targetPane) {
    return {
      minWidth: props.orientation === 'horizontal' ? minSize : undefined,
      minHeight: props.orientation === 'vertical' ? minSize : undefined,
    }
  }

  if (!props.fixedSize) {
    return {
      minWidth: props.orientation === 'horizontal' ? minSize : undefined,
      minHeight: props.orientation === 'vertical' ? minSize : undefined,
    }
  }

  return {
    flexBasis: props.fixedSize,
    width: props.orientation === 'horizontal' ? props.fixedSize : undefined,
    height: props.orientation === 'vertical' ? props.fixedSize : undefined,
    minWidth: props.orientation === 'horizontal' ? minSize : undefined,
    minHeight: props.orientation === 'vertical' ? minSize : undefined,
  }
}

const primaryPaneStyle = computed(() => resolveFixedPaneStyle('primary', props.primaryMinSize))
const secondaryPaneStyle = computed(() => resolveFixedPaneStyle('secondary', props.secondaryMinSize))
</script>

<style scoped>
.oc-split-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
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
