<!-- Base 条形容器：独立实现栏位结构与基础背景/边框语义，不依赖 shared primitives。 -->
<template>
  <component :is="as" class="oc-bar" :class="barClass">
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
import { computed, useSlots } from 'vue'

type BarKind = 'top' | 'status' | 'section'
type BarBorder = 'none' | 'top' | 'bottom'
type BarSpacing = 'compact' | 'default' | 'spacious'
type BarInset = 'none' | 'compact' | 'default' | 'spacious'

interface OcBarProps {
  /** 根元素标签。 */
  as?: string
  /** 栏位语义类型。 */
  kind?: BarKind
  /** 内部项间距语义。 */
  spacing?: BarSpacing
  /** 水平内边距语义。 */
  inset?: BarInset
  /** 边框位置语义。 */
  border?: BarBorder
}

defineOptions({ name: 'OcBar' })

const props = withDefaults(defineProps<OcBarProps>(), {
  as: 'div',
  kind: 'section',
  spacing: undefined,
  inset: undefined,
  border: 'none',
})

const slots = useSlots()

const barClass = computed(() => [
  `oc-bar--kind-${props.kind}`,
  `oc-bar--border-${props.border}`,
  props.spacing ? `oc-bar--spacing-${props.spacing}` : null,
  props.inset ? `oc-bar--inset-${props.inset}` : null,
])
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

.oc-bar--spacing-compact {
  --oc-bar-gap: var(--oc-space-1);
}

.oc-bar--spacing-default {
  --oc-bar-gap: var(--oc-space-2);
}

.oc-bar--spacing-spacious {
  --oc-bar-gap: var(--oc-space-3);
}

.oc-bar--inset-none {
  --oc-bar-padding: 0;
}

.oc-bar--inset-compact {
  --oc-bar-padding: 0 var(--oc-space-1);
}

.oc-bar--inset-default {
  --oc-bar-padding: 0 var(--oc-space-2);
}

.oc-bar--inset-spacious {
  --oc-bar-padding: 0 var(--oc-space-3);
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
  flex: 0 1 auto;
}

.oc-bar__main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
}
</style>
