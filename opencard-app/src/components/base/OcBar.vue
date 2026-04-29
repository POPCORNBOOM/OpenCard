<!-- Base 语义条组件：统一 icon/title/main/append 行结构，屏蔽底层面板样式细节。 -->
<template>
  <div class="oc-bar" :class="rootClass" :style="rootStyle" v-bind="forwardedAttrs">
    <OcPanel
      orientation="horizontal"
      horizontal-alignment="start"
      vertical-alignment="center"
      tone="transparent"
      border="none"
      radius="none"
      elevation="none"
      padding="none"
      overflow-x="clip"
      overflow-y="clip"
    >
      <div v-if="hasLeading" class="oc-bar__leading">
        <div v-if="hasIcon" class="oc-bar__icon">
          <slot name="icon">
            <OcIcon v-if="props.icon" :name="props.icon" size="sm" :tone="props.disabled ? 'muted' : 'primary'" />
          </slot>
        </div>

        <div v-if="hasTitle" class="oc-bar__title">
          <slot name="title">
            <OcText :truncate="props.truncateTitle" :tone="props.disabled ? 'muted' : undefined">
              {{ props.title }}
            </OcText>
          </slot>
        </div>
      </div>

      <div v-if="hasMain" class="oc-bar__main">
        <slot />
      </div>

      <div v-if="hasAppend" class="oc-bar__append">
        <div v-if="$slots.append" class="oc-bar__append-default">
          <slot name="append" />
        </div>
        <div v-if="hasHoverAppend" class="oc-bar__append-hover">
          <slot name="append-hover" />
        </div>
      </div>
    </OcPanel>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots, watchEffect } from 'vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from './OcIcon.vue'
import OcPanel from './OcPanel.vue'
import OcText from './OcText.vue'

const OC_BAR_KINDS = ['plain', 'top', 'status', 'section', 'tab', 'tree', 'card'] as const
const OC_BAR_LAYOUTS = ['auto', 'leading-main-append', 'leading-append', 'main-append'] as const
const OC_BAR_STATES = [
  'default',
  'selected',
  'dragging',
  'drop-before',
  'drop-inside',
  'drop-after',
  'drop-invalid',
] as const

type OcBarKind = (typeof OC_BAR_KINDS)[number]
type OcBarLayout = (typeof OC_BAR_LAYOUTS)[number]
type OcBarState = (typeof OC_BAR_STATES)[number]

interface OcBarProps {
  /** 行语义类型（决定高度、边框与默认视觉）。 */
  kind?: OcBarKind
  /** 三段布局模式。 */
  layout?: OcBarLayout
  /** 行状态语义（用于选中/拖拽/落点反馈）。 */
  state?: OcBarState
  /** 是否激活（常用于 tab 当前项）。 */
  active?: boolean
  /** 是否禁用。 */
  disabled?: boolean
  /** 是否启用悬浮高亮。 */
  hoverable?: boolean
  /** 树节点缩进像素（仅 tree kind 常用）。 */
  indent?: number
  /** 左侧图标（可被 #icon 覆盖）。 */
  icon?: IconToken
  /** 左侧标题文本（可被 #title 覆盖）。 */
  title?: string
  /** 标题是否单行省略。 */
  truncateTitle?: boolean
}

defineOptions({
  name: 'OcBar',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcBarProps>(), {
  kind: 'plain',
  layout: 'auto',
  state: 'default',
  active: false,
  disabled: false,
  hoverable: false,
  indent: 0,
  icon: undefined,
  title: undefined,
  truncateTitle: true,
})

const attrs = useAttrs()
const slots = useSlots()

const forwardedAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

if (import.meta.env.DEV) {
  watchEffect(() => {
    if (attrs.class === undefined && attrs.style === undefined) {
      return
    }

    console.warn('[OcBar] External class/style attrs are ignored. Use semantic props and slots.')
  })
}

const hasIcon = computed(() => Boolean(props.icon) || Boolean(slots.icon))
const hasTitle = computed(() => Boolean(props.title) || Boolean(slots.title))
const hasLeading = computed(() => hasIcon.value || hasTitle.value)
const hasMain = computed(() => Boolean(slots.default))
const hasHoverAppend = computed(() => Boolean(slots['append-hover']))
const hasAppend = computed(() => Boolean(slots.append) || hasHoverAppend.value)

const resolvedLayout = computed<Exclude<OcBarLayout, 'auto'>>(() => {
  if (props.layout !== 'auto') {
    return props.layout
  }

  if (hasLeading.value && hasMain.value) {
    return 'leading-main-append'
  }

  if (hasLeading.value) {
    return 'leading-append'
  }

  return 'main-append'
})

const rootClass = computed(() => [
  `oc-bar--kind-${props.kind}`,
  `oc-bar--layout-${resolvedLayout.value}`,
  `oc-bar--state-${props.state}`,
  {
    'is-active': props.active,
    'is-disabled': props.disabled,
    'is-hoverable': props.hoverable,
    'has-hover-append': hasHoverAppend.value,
  },
])

const rootStyle = computed(() => ({
  '--oc-bar-indent': `${Math.max(0, Math.round(props.indent))}px`,
}))
</script>

<style scoped>
.oc-bar {
  --oc-bar-min-height: var(--oc-block-md);
  --oc-bar-gap: var(--oc-space-2);
  --oc-bar-inline-padding: 0px;
  --oc-bar-bg: transparent;
  --oc-bar-border-color: transparent;
  --oc-bar-border-top-color: transparent;
  --oc-bar-border-bottom-color: transparent;
  --oc-bar-fg: var(--oc-text-primary);
  min-width: 0;
  min-height: 0;
  display: flex;
  color: var(--oc-bar-fg);
}

.oc-bar > :deep(.oc-panel) {
  flex: 1 1 auto;
  min-width: 0;
  min-height: var(--oc-bar-min-height);
  border-top: var(--oc-thickness-1) solid var(--oc-bar-border-top-color);
  border-right: var(--oc-thickness-1) solid var(--oc-bar-border-color);
  border-bottom: var(--oc-thickness-1) solid var(--oc-bar-border-bottom-color);
  border-left: var(--oc-thickness-1) solid var(--oc-bar-border-color);
  background: var(--oc-bar-bg);
}

.oc-bar__leading,
.oc-bar__main,
.oc-bar__append {
  min-width: 0;
  min-height: 0;
}

.oc-bar__leading {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  padding-left: calc(var(--oc-bar-inline-padding) + var(--oc-bar-indent));
}

.oc-bar__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.oc-bar__title {
  min-width: 0;
  flex: 1 1 auto;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
}

.oc-bar__title :deep(*) {
  min-width: 0;
  max-width: 100%;
}

.oc-bar__main {
  display: inline-flex;
  align-items: center;
  gap: var(--oc-bar-gap);
}

.oc-bar__append {
  margin-left: auto;
  padding-right: var(--oc-bar-inline-padding);
  display: inline-grid;
  align-items: center;
  justify-items: end;
  flex: 0 0 auto;
}

.oc-bar__append-default,
.oc-bar__append-hover {
  grid-area: 1 / 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--oc-bar-gap);
}

.oc-bar--layout-leading-main-append .oc-bar__leading {
  flex: 0 1 auto;
}

.oc-bar--layout-leading-main-append .oc-bar__main {
  flex: 1 1 auto;
}

.oc-bar--layout-leading-append .oc-bar__leading {
  flex: 1 1 auto;
}

.oc-bar--layout-main-append .oc-bar__main {
  flex: 1 1 auto;
  padding-left: var(--oc-bar-inline-padding);
}

.oc-bar.has-hover-append .oc-bar__append-hover {
  opacity: 0;
  pointer-events: none;
}

.oc-bar.has-hover-append:hover .oc-bar__append-default,
.oc-bar.has-hover-append:focus-within .oc-bar__append-default {
  opacity: 0;
  pointer-events: none;
}

.oc-bar.has-hover-append:hover .oc-bar__append-hover,
.oc-bar.has-hover-append:focus-within .oc-bar__append-hover {
  opacity: 1;
  pointer-events: auto;
}

.oc-bar.is-hoverable:hover:not(.is-disabled),
.oc-bar.is-hoverable:focus-within:not(.is-disabled) {
  --oc-bar-bg: var(--oc-bg-hover);
}

.oc-bar:focus-visible > :deep(.oc-panel) {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: -1px;
  position: relative;
  z-index: 1;
}

.oc-bar.is-active {
  --oc-bar-bg: var(--oc-bg-active);
}

.oc-bar.is-disabled {
  --oc-bar-fg: var(--oc-text-disabled);
  opacity: 0.9;
  cursor: default;
}

.oc-bar--kind-plain {
  --oc-bar-min-height: var(--oc-block-md);
  --oc-bar-inline-padding: 0px;
}

.oc-bar--kind-top {
  --oc-bar-min-height: 52px;
  --oc-bar-gap: 18px;
  --oc-bar-inline-padding: 18px;
  --oc-bar-bg: var(--oc-bg-elevated);
  --oc-bar-border-bottom-color: var(--oc-border-strong);
}

.oc-bar--kind-status {
  --oc-bar-min-height: 24px;
  --oc-bar-gap: 10px;
  --oc-bar-inline-padding: 14px;
  --oc-bar-bg: var(--oc-bg-elevated);
  --oc-bar-border-top-color: var(--oc-border-strong);
  --oc-bar-fg: var(--oc-text-secondary);
  font-size: 12px;
}

.oc-bar--kind-section {
  --oc-bar-min-height: 24px;
  --oc-bar-inline-padding: 0px;
  --oc-bar-border-bottom-color: var(--oc-border-strong);
  --oc-bar-fg: var(--oc-text-secondary);
}

.oc-bar--kind-tab {
  --oc-bar-min-height: 32px;
  --oc-bar-inline-padding: 10px;
  --oc-bar-bg: var(--oc-bg-panel);
  --oc-bar-border-color: var(--oc-border-strong);
  --oc-bar-border-bottom-color: transparent;
  max-width: 320px;
  cursor: pointer;
}

.oc-bar--kind-tab.is-active {
  --oc-bar-bg: var(--oc-bg-base);
  --oc-bar-border-bottom-color: var(--oc-bg-base);
}

.oc-bar--kind-tree {
  --oc-bar-min-height: var(--oc-block-md);
  --oc-bar-inline-padding: var(--oc-space-2);
  cursor: pointer;
}

.oc-bar--kind-card {
  --oc-bar-min-height: var(--oc-block-lg);
  --oc-bar-inline-padding: var(--oc-padding-standard);
  --oc-bar-gap: var(--oc-space-2);
  font-size: var(--oc-title-size);
  font-weight: 600;
  color: var(--oc-text-primary);
}

.oc-bar--state-selected {
  --oc-bar-bg: var(--oc-bg-selected);
}

.oc-bar--state-dragging {
  opacity: 0.45;
}

.oc-bar--state-drop-before > :deep(.oc-panel) {
  box-shadow: inset 0 2px 0 var(--oc-bg-accent);
}

.oc-bar--state-drop-inside {
  --oc-bar-bg: var(--oc-bg-accent-soft);
}

.oc-bar--state-drop-after > :deep(.oc-panel) {
  box-shadow: inset 0 -2px 0 var(--oc-bg-accent);
}

.oc-bar--state-drop-invalid > :deep(.oc-panel) {
  box-shadow: inset 0 0 0 1px var(--oc-danger);
}
</style>
