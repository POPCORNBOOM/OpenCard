<template>
  <OcSurface
    :as="as"
    class="oc-floating-panel-shell"
    :class="shellClass"
    variant="transparent"
    :radius="radius"
    :shadow="shadow"
  >
    <slot />
  </OcSurface>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { OcSurface } from '../../shared/ui/primitives'

type FloatingPanelShellPadding = 'none' | 'sm' | 'md'
type FloatingPanelShellRadius = 'sm' | 'md' | 'lg'
type FloatingPanelShellShadow = 'sm' | 'md' | 'overlay'
type FloatingPanelShellDimension = 'auto' | 'content' | 'full' | 'screen' | 'panel'
type FloatingPanelShellInset = 'none' | 'compact' | 'default' | 'spacious' | 'overlay'
type FloatingPanelShellPointer = 'auto' | 'none'

defineOptions({ name: 'OcFloatingPanelShell' })

const props = withDefaults(defineProps<{
  as?: string
  padding?: FloatingPanelShellPadding
  radius?: FloatingPanelShellRadius
  shadow?: FloatingPanelShellShadow
  blurred?: boolean
  width?: FloatingPanelShellDimension
  height?: FloatingPanelShellDimension
  inset?: FloatingPanelShellInset
  pointer?: FloatingPanelShellPointer
}>(), {
  as: 'div',
  padding: 'none',
  radius: 'lg',
  shadow: 'overlay',
  blurred: true,
  width: 'auto',
  height: 'auto',
  inset: 'none',
  pointer: 'auto',
})

const shellClass = computed(() => [
  `oc-floating-panel-shell--padding-${props.padding}`,
  `oc-floating-panel-shell--width-${props.width}`,
  `oc-floating-panel-shell--height-${props.height}`,
  `oc-floating-panel-shell--inset-${props.inset}`,
  `oc-floating-panel-shell--pointer-${props.pointer}`,
  {
    'is-blurred': props.blurred,
  },
])
</script>

<style scoped>
.oc-floating-panel-shell {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--oc-border-overlay-soft);
  background: var(--oc-bg-overlay-soft);
}

.oc-floating-panel-shell.is-blurred {
  backdrop-filter: blur(14px);
}

.oc-floating-panel-shell--padding-none {
  padding: 0;
}

.oc-floating-panel-shell--padding-sm {
  padding: var(--oc-space-2);
}

.oc-floating-panel-shell--padding-md {
  padding: var(--oc-space-3);
}

.oc-floating-panel-shell--width-auto {
  width: auto;
}

.oc-floating-panel-shell--width-content {
  width: fit-content;
}

.oc-floating-panel-shell--width-full {
  width: 100%;
}

.oc-floating-panel-shell--width-screen {
  width: 100vw;
}

.oc-floating-panel-shell--width-panel {
  width: var(--oc-floating-panel-shell-width, 280px);
}

.oc-floating-panel-shell--height-auto {
  height: auto;
}

.oc-floating-panel-shell--height-content {
  height: fit-content;
}

.oc-floating-panel-shell--height-full {
  height: 100%;
}

.oc-floating-panel-shell--height-screen {
  height: 100vh;
}

.oc-floating-panel-shell--height-panel {
  height: var(--oc-floating-panel-shell-height, 180px);
}

.oc-floating-panel-shell--inset-none {
  margin-top: 0;
}

.oc-floating-panel-shell--inset-compact {
  margin-top: var(--oc-space-1);
}

.oc-floating-panel-shell--inset-default {
  margin-top: var(--oc-space-2);
}

.oc-floating-panel-shell--inset-spacious {
  margin-top: var(--oc-space-3);
}

.oc-floating-panel-shell--inset-overlay {
  margin-top: var(--oc-floating-panel-shell-inset-overlay, calc(var(--card-editor-overlay-inset-y, 20px) - 6px));
}

.oc-floating-panel-shell--pointer-auto {
  pointer-events: auto;
}

.oc-floating-panel-shell--pointer-none {
  pointer-events: none;
}
</style>
