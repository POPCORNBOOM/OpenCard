<!-- Base 卡片容器：只负责 title/content 双区块结构，不承载业务状态。 -->
<template>
  <OcPanel class="oc-card" v-bind="rootBindings" orientation="vertical" horizontal-alignment="stretch"
    vertical-alignment="start">
    <header v-if="hasHeader" class="oc-card__title" :class="{ 'oc-card__title--with-divider': !props.collapsed }"
      :style="densityPaddingStyle">
      <div v-if="hasTitle" class="oc-card__title-main">
        <slot name="title">{{ props.title }}</slot>
      </div>
      <div v-if="$slots.append || $slots['append-hover']" class="oc-card__append" :class="{
        'has-hover-slot': Boolean($slots['append-hover']),
      }">
        <div v-if="$slots.append" class="oc-card__append-default">
          <slot name="append" />
        </div>
        <div v-if="$slots['append-hover']" class="oc-card__append-hover">
          <slot name="append-hover" />
        </div>
      </div>
    </header>

    <OcPanel v-if="!props.collapsed" as="section" class="oc-card__content" tone="transparent" border="none"
      radius="none" elevation="none" :padding="densityPadding" orientation="vertical" horizontal-alignment="stretch"
      vertical-alignment="start" :grow="props.fill">
      <slot name="content">
        <slot />
      </slot>
    </OcPanel>
  </OcPanel>
</template>

<script setup lang="ts">
import { computed, type CSSProperties, type PropType, useAttrs, useSlots } from 'vue'
import OcPanel, { type OcPanelPadding, type OcPanelProps, ocPanelProps } from './OcPanel.vue'

const OC_CARD_DENSITIES = [
  'none',
  'compact',
  'standard',
] as const

export type OcCardDensity = (typeof OC_CARD_DENSITIES)[number]

defineOptions({
  name: 'OcCard',
  inheritAttrs: false,
})

const props = defineProps({
  ...ocPanelProps,
  /** 卡片标题文案。 */
  title: {
    type: String,
    default: undefined,
  },
  /** 是否折叠内容区。true 时仅保留标题区。 */
  collapsed: {
    type: Boolean,
    default: false,
  },
  padding: {
    type: String as PropType<OcPanelPadding>,
    default: 'none',
  },
  /** 内容区内边距密度。 */
  density: {
    type: String as PropType<OcCardDensity>,
    default: 'standard',
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
const rootBindings = computed<Record<string, unknown>>(() => ({
  ...panelPropBindings.value,
  ...attrs,
}))

const hasTitle = computed(() => Boolean(props.title) || Boolean(slots.title))
const hasHeader = computed(() =>
  hasTitle.value || Boolean(slots.append) || Boolean(slots['append-hover']),
)
const densityPaddingValue = computed(() => {
  if (props.density === 'none') {
    return 'var(--oc-padding-none)'
  }
  if (props.density === 'compact') {
    return 'var(--oc-padding-compact)'
  }

  return 'var(--oc-padding-standard)'
})
const densityPadding = computed<OcPanelPadding>(() => {
  if (props.density === 'none') {
    return 'none'
  }
  if (props.density === 'compact') {
    return 'compact'
  }

  return 'standard'
})
const densityPaddingStyle = computed<CSSProperties>(() => ({
  '--oc-card-density-padding': densityPaddingValue.value,
}))
</script>

<style scoped>
.oc-card__title {
  min-height: var(--oc-block-lg);
  padding: var(--oc-padding-standard);
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
  color: var(--oc-text-primary);
  font-size: var(--oc-title-size);
  font-weight: 600;
  flex: 0 0 auto;
}

.oc-card__title-main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.oc-card__append {
  margin-left: auto;
  min-width: 0;
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.oc-card__append-default,
.oc-card__append-hover {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-space-2);
}

.oc-card__append.has-hover-slot .oc-card__append-hover {
  display: none;
}

.oc-card:hover .oc-card__append.has-hover-slot .oc-card__append-default {
  display: none;
}

.oc-card:hover .oc-card__append.has-hover-slot .oc-card__append-hover {
  display: inline-flex;
}

.oc-card__title--with-divider {
  border-bottom: var(--oc-thickness-1) solid var(--oc-panel-border, var(--oc-border-overlay-soft));
}

.oc-card__content {
  gap: var(--oc-space-2);
}
</style>
