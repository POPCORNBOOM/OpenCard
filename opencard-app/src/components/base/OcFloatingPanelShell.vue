<template>
  <OcSurface
    :as="as"
    class="oc-floating-panel-shell"
    :class="shellClass"
    :style="shellStyle"
    variant="transparent"
    :radius="radius"
    :shadow="shadow"
  >
    <slot />
  </OcSurface>
</template>

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue'
import { OcSurface } from '../../shared/ui/primitives'

type FloatingPanelShellPadding = 'none' | 'sm' | 'md'
type FloatingPanelShellRadius = 'sm' | 'md' | 'lg'
type FloatingPanelShellShadow = 'sm' | 'md' | 'overlay'

defineOptions({ name: 'OcFloatingPanelShell' })

const props = withDefaults(defineProps<{
  as?: string
  padding?: FloatingPanelShellPadding
  radius?: FloatingPanelShellRadius
  shadow?: FloatingPanelShellShadow
  blurred?: boolean
  width?: string
  height?: string
  marginTop?: string
  pointerEvents?: 'auto' | 'none'
}>(), {
  as: 'div',
  padding: 'none',
  radius: 'lg',
  shadow: 'overlay',
  blurred: true,
  width: undefined,
  height: undefined,
  marginTop: undefined,
  pointerEvents: undefined,
})

const shellClass = computed(() => [
  `oc-floating-panel-shell--padding-${props.padding}`,
  {
    'is-blurred': props.blurred,
  },
])

const shellStyle = computed<CSSProperties>(() => ({
  ...(props.width ? { width: props.width } : {}),
  ...(props.height ? { height: props.height } : {}),
  ...(props.marginTop ? { marginTop: props.marginTop } : {}),
  ...(props.pointerEvents ? { pointerEvents: props.pointerEvents } : {}),
}))
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
</style>
