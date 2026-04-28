<!-- Base 条形容器：统一提供 icon/title 头部语义、可插入主内容和右侧追加区。 -->
<template>
  <OcPanel
    :as="as"
    class="oc-bar"
    :class="barClass"
    :tone="barTone"
    radius="none"
    border="none"
    padding="none"
    orientation="horizontal"
    horizontal-alignment="start"
    vertical-alignment="center"
  >
    <div v-if="hasLeading" class="oc-bar__leading">
      <div v-if="hasIcon" class="oc-bar__icon">
        <slot name="icon">
          <OcIcon v-if="icon" :name="icon" size="sm" tone="muted" />
        </slot>
      </div>
      <div v-if="hasTitle" class="oc-bar__title">
        <slot name="title">{{ title }}</slot>
      </div>
    </div>
    <div class="oc-bar__main">
      <slot />
    </div>
    <div v-if="slots.append" class="oc-bar__append">
      <slot name="append" />
    </div>
  </OcPanel>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import OcIcon from './OcIcon.vue'
import OcPanel from './OcPanel.vue'

type BarKind = 'top' | 'status' | 'section'
type BarBorder = 'none' | 'top' | 'bottom'
type BarSpacing = 'compact' | 'default' | 'spacious'
type BarInset = 'none' | 'compact' | 'default' | 'spacious'
type BarTone = 'base' | 'panel' | 'elevated' | 'transparent'

interface OcBarProps {
  /** 根元素标签。 */
  as?: string
  /** 左侧图标（默认渲染，可由 #icon 覆写）。 */
  icon?: string
  /** 左侧标题（默认渲染，可由 #title 覆写）。 */
  title?: string
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
  icon: undefined,
  title: undefined,
  kind: 'section',
  spacing: undefined,
  inset: undefined,
  border: 'none',
})

const slots = useSlots()
const hasIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon))
const hasTitle = computed(() => Boolean(props.title) || Boolean(slots.title))
const hasLeading = computed(() => hasIcon.value || hasTitle.value)

const barClass = computed(() => [
  `oc-bar--kind-${props.kind}`,
  `oc-bar--border-${props.border}`,
  props.spacing ? `oc-bar--spacing-${props.spacing}` : null,
  props.inset ? `oc-bar--inset-${props.inset}` : null,
])

const barTone = computed<BarTone>(() => {
  if (props.kind === 'section') {
    return 'transparent'
  }

  return 'elevated'
})
</script>

<style scoped>
.oc-bar {
  --oc-bar-gap: var(--oc-space-2);
  --oc-bar-padding: 0;
  min-width: 0;
  min-height: 0;
  border-width: 0;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  padding: var(--oc-bar-padding);
}

.oc-bar--kind-top {
  --oc-bar-gap: 18px;
  --oc-bar-padding: 0 18px;
  min-height: 52px;
}

.oc-bar--kind-status {
  --oc-bar-gap: 10px;
  --oc-bar-padding: 0 14px;
  min-height: 24px;
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

.oc-bar__leading {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  flex: 0 1 auto;
}

.oc-bar__icon {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

.oc-bar__title {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-1);
  color: var(--oc-text-primary);
}

.oc-bar__main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
}

.oc-bar__append {
  min-width: 0;
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  flex: 0 1 auto;
}
</style>
