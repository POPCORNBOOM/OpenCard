<!-- Base 条形容器：只负责 leading/main/append 三段结构与 icon/title 语义。 -->
<template>
  <OcPanel class="oc-bar" v-bind="rootBindings" orientation="horizontal" horizontal-alignment="start"
    vertical-alignment="center">
    <div v-if="hasLeading" class="oc-bar__leading">
      <div v-if="hasIcon" class="oc-bar__icon">
        <slot name="icon">
          <OcIcon v-if="props.icon" :name="props.icon" size="sm" tone="muted" />
        </slot>
      </div>
      <div v-if="hasTitle" class="oc-bar__title">
        <slot name="title">
          <OcText>{{ props.title }}</OcText>
        </slot>
      </div>
    </div>
    <div class="oc-bar__main">
      <slot />
    </div>
    <div v-if="hasAppendArea" class="oc-bar__append" :class="{ 'has-hover-replacement': hasHoverAppend }">
      <div v-if="hasAppend" class="oc-bar__append-default">
        <slot name="append" />
      </div>
      <div v-if="hasHoverAppend" class="oc-bar__append-hover">
        <slot name="append-hover" />
      </div>
    </div>
  </OcPanel>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots, type PropType } from 'vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from './OcIcon.vue'
import OcPanel, { type OcPanelProps, ocPanelProps } from './OcPanel.vue'
import OcText from './OcText.vue'

defineOptions({
  name: 'OcBar',
  inheritAttrs: false,
})

const props = defineProps({
  ...ocPanelProps,
  /** 左侧图标（默认渲染，可由 #icon 覆写）。 */
  icon: {
    type: String as PropType<IconToken>,
    default: undefined,
  },
  /** 左侧标题（默认渲染，可由 #title 覆写）。 */
  title: {
    type: String,
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

const hasIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon))
const hasTitle = computed(() => Boolean(props.title) || Boolean(slots.title))
const hasLeading = computed(() => hasIcon.value || hasTitle.value)
const hasAppend = computed(() => Boolean(slots.append))
const hasHoverAppend = computed(() => Boolean(slots['append-hover']))
const hasAppendArea = computed(() => hasAppend.value || hasHoverAppend.value)
</script>

<style scoped>
.oc-bar {
  --oc-bar-gap: var(--oc-space-2, 8px);
  --oc-bar-padding: 0;
  --oc-bar-min-height: 24px;
  min-width: 0;
  min-height: var(--oc-bar-min-height);
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  padding: var(--oc-bar-padding);
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
  display: flex;
  align-items: center;
  flex: 0 1 auto;
}

.oc-bar__append-default,
.oc-bar__append-hover {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: var(--oc-bar-gap);
}

.oc-bar__append-hover {
  display: none;
}

.oc-bar:hover .oc-bar__append.has-hover-replacement .oc-bar__append-default {
  display: none;
}

.oc-bar:hover .oc-bar__append.has-hover-replacement .oc-bar__append-hover {
  display: inline-flex;
}
</style>
