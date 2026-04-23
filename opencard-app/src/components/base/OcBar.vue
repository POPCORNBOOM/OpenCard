<template>
  <component
    :is="as"
    class="oc-bar"
    :class="barClass"
    :style="barStyle"
  >
    <div v-if="slots.start" class="oc-bar__start">
      <slot name="start" />
    </div>
    <div class="oc-bar__main">
      <slot />
    </div>
    <div v-if="slots.end" class="oc-bar__end">
      <slot name="end" />
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, useSlots, type CSSProperties } from 'vue'

type BarKind = 'top' | 'status' | 'section'
type BarBorder = 'none' | 'top' | 'bottom'

defineOptions({ name: 'OcBar' })

const props = withDefaults(defineProps<{
  as?: string
  kind?: BarKind
  padding?: string
  gap?: string
  border?: BarBorder
}>(), {
  as: 'div',
  kind: 'section',
  padding: undefined,
  gap: undefined,
  border: 'none',
})

const slots = useSlots()

const barClass = computed(() => [
  `oc-bar--kind-${props.kind}`,
  `oc-bar--border-${props.border}`,
])

const barStyle = computed<CSSProperties>(() => ({
  ...(props.padding ? { '--oc-bar-padding': props.padding } : {}),
  ...(props.gap ? { '--oc-bar-gap': props.gap } : {}),
}))
</script>

<style scoped>
.oc-bar {
  --oc-bar-gap: var(--oc-space-2);
  --oc-bar-padding: 0;
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  padding: var(--oc-bar-padding);
}

.oc-bar--kind-top {
  --oc-bar-gap: 18px;
  --oc-bar-padding: 0 18px;
  min-height: 52px;
  background: var(--oc-bg-app-chrome);
}

.oc-bar--kind-status {
  --oc-bar-gap: 10px;
  --oc-bar-padding: 0 14px;
  min-height: 24px;
  background: var(--oc-bg-app-chrome);
  color: var(--oc-text-secondary);
  font-size: 12px;
}

.oc-bar--kind-section {
  min-height: 24px;
}

.oc-bar--border-top {
  border-top: 1px solid var(--oc-border-strong);
}

.oc-bar--border-bottom {
  border-bottom: 1px solid var(--oc-border-strong);
}

.oc-bar__start,
.oc-bar__end {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  flex-shrink: 0;
}

.oc-bar__main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
}
</style>
