<!-- Base 条形容器：统一提供 icon/title 头部语义、可插入主内容和右侧追加区。 -->
<template>
  <OcPanel
    class="oc-bar"
    :class="barClass"
    v-bind="rootBindings"
    orientation="horizontal"
    horizontal-alignment="start"
    vertical-alignment="center"
  >
    <div v-if="hasLeading" class="oc-bar__leading">
      <div v-if="hasIcon" class="oc-bar__icon">
        <slot name="icon">
          <OcIcon v-if="props.icon" :name="props.icon" size="sm" tone="muted" />
        </slot>
      </div>
      <div v-if="hasTitle" class="oc-bar__title">
        <slot name="title">{{ props.title }}</slot>
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
import { computed, type PropType, useAttrs, useSlots } from 'vue'
import OcIcon from './OcIcon.vue'
import OcPanel, {
  type OcPanelBorder,
  type OcPanelPadding,
  type OcPanelProps,
  type OcPanelRadius,
  type OcPanelTone,
  ocPanelProps,
} from './OcPanel.vue'

type BarKind = 'top' | 'status' | 'section'
type BarDivider = 'none' | 'top' | 'bottom'
type BarSpacing = 'compact' | 'default' | 'spacious'
type BarInset = 'none' | 'compact' | 'default' | 'spacious'
defineOptions({
  name: 'OcBar',
  inheritAttrs: false,
})

const props = defineProps({
  ...ocPanelProps,
  /** 左侧图标（默认渲染，可由 #icon 覆写）。 */
  icon: {
    type: String,
    default: undefined,
  },
  /** 左侧标题（默认渲染，可由 #title 覆写）。 */
  title: {
    type: String,
    default: undefined,
  },
  /** 栏位语义类型。 */
  kind: {
    type: String as PropType<BarKind>,
    default: 'section',
  },
  /** 内部项间距语义。 */
  spacing: {
    type: String as PropType<BarSpacing>,
    default: undefined,
  },
  /** 水平内边距语义。 */
  inset: {
    type: String as PropType<BarInset>,
    default: undefined,
  },
  /** 额外分隔线位置语义。 */
  divider: {
    type: String as PropType<BarDivider>,
    default: 'none',
  },
  /** 覆盖面板 tone（默认按 kind 推断）。 */
  tone: {
    type: String as PropType<OcPanelTone>,
    default: undefined,
  },
  /** 覆盖面板 radius（默认 none）。 */
  radius: {
    type: String as PropType<OcPanelRadius>,
    default: undefined,
  },
  /** 覆盖面板 border（默认 none）。 */
  border: {
    type: String as PropType<OcPanelBorder>,
    default: undefined,
  },
  /** 覆盖面板 padding（默认 none）。 */
  padding: {
    type: String as PropType<OcPanelPadding>,
    default: undefined,
  },
})

const attrs = useAttrs()
const slots = useSlots()
type MutableOcPanelProps = { -readonly [Key in keyof OcPanelProps]: OcPanelProps[Key] }
const panelPropKeys = Object.keys(ocPanelProps) as Array<keyof OcPanelProps>
const lockedPanelPropKeys = new Set<keyof OcPanelProps>([
  'orientation',
  'horizontalAlignment',
  'verticalAlignment',
  'tone',
  'radius',
  'border',
  'padding',
])

const panelPropBindings = computed<Partial<MutableOcPanelProps>>(() => {
  const bindings: Record<string, unknown> = {}
  for (const key of panelPropKeys) {
    if (lockedPanelPropKeys.has(key)) {
      continue
    }
    bindings[key] = props[key]
  }
  return bindings as Partial<MutableOcPanelProps>
})

const resolvedTone = computed<OcPanelTone>(() => {
  if (props.tone) {
    return props.tone
  }

  if (props.kind === 'section') {
    return 'transparent'
  }

  return 'elevated'
})

const resolvedRadius = computed<OcPanelRadius>(() => props.radius ?? 'none')
const resolvedBorder = computed<OcPanelBorder>(() => props.border ?? 'none')
const resolvedPadding = computed<OcPanelPadding>(() => props.padding ?? 'none')

const rootBindings = computed<Record<string, unknown>>(() => ({
  ...panelPropBindings.value,
  tone: resolvedTone.value,
  radius: resolvedRadius.value,
  border: resolvedBorder.value,
  padding: resolvedPadding.value,
  ...attrs,
}))

const hasIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon))
const hasTitle = computed(() => Boolean(props.title) || Boolean(slots.title))
const hasLeading = computed(() => hasIcon.value || hasTitle.value)

const barClass = computed(() => [
  `oc-bar--kind-${props.kind}`,
  `oc-bar--divider-${props.divider}`,
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

.oc-bar--divider-top {
  border-top: 1px solid var(--oc-border-strong);
}

.oc-bar--divider-bottom {
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
