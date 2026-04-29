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
          <OcText :truncate="props.truncateTitle">{{ props.title }}</OcText>
        </slot>
      </div>
    </div>
    <div class="oc-bar__main">
      <slot />
    </div>
    <div v-if="$slots.append || $slots['append-hover']" class="oc-bar__append" :class="{
      'has-hover-slot': Boolean($slots['append-hover']),
    }">
      <div v-if="$slots.append" class="oc-bar__append-default">
        <slot name="append" />
      </div>
      <div v-if="$slots['append-hover']" class="oc-bar__append-hover">
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
  /** 默认标题是否单行省略（仅作用于 title prop 渲染路径）。 */
  truncateTitle: {
    type: Boolean,
    default: true,
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
</script>

<style scoped>
.oc-bar {
  --oc-bar-gap: var(--oc-space-2, 8px);
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
}

.oc-bar__leading {
  margin-left: var(--oc-bar-gap);
  min-width: 0;
  overflow: hidden;
  display: flex;
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
  overflow: hidden;
  display: flex;
  align-items: center;
  gap: var(--oc-space-1);
  flex: 1 1 auto;
  color: var(--oc-text-primary);
}

.oc-bar__title :deep(*) {
  min-width: 0;
  max-width: 100%;
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
  margin-right: var(--oc-bar-gap);
  display: flex;
  align-items: center;
  flex: 0 0 auto;
}

.oc-bar__append-default,
.oc-bar__append-hover {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--oc-bar-gap);
}

.oc-bar__append.has-hover-slot .oc-bar__append-hover {
  display: none;
}

.oc-bar:hover .oc-bar__append.has-hover-slot .oc-bar__append-default {
  display: none;
}

.oc-bar:hover .oc-bar__append.has-hover-slot .oc-bar__append-hover {
  display: inline-flex;
}
</style>
