<!-- Base 语义条组件：仅负责 icon/title 与 append 区域的结构排版和截断优先级。 -->
<template>
  <div class="oc-bar" :class="{ 'has-hover-append': hasHoverAppend }" v-bind="forwardedAttrs">
    <div class="oc-bar__leading">
      <div v-if="hasIcon" class="oc-bar__icon">
        <slot name="icon">
          <OcIcon v-if="props.icon" :name="props.icon" size="sm" />
        </slot>
      </div>

      <div v-if="hasTitle" class="oc-bar__title">
        <slot name="title">
          <OcText :truncate="props.truncateTitle">
            {{ props.title }}
          </OcText>
        </slot>
      </div>
    </div>

    <div v-if="hasAppend" class="oc-bar__append">
      <div v-if="$slots.append" class="oc-bar__append-default">
        <slot name="append" />
      </div>
      <div v-if="hasHoverAppend" class="oc-bar__append-hover">
        <slot name="append-hover" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots, watchEffect } from 'vue'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'
import OcIcon from './OcIcon.vue'
import OcText from './OcText.vue'

interface OcBarProps {
  /** 左侧图标 token（可被 #icon 覆盖）。 */
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
const hasTitle = computed(() => (props.title ?? '').length > 0 || Boolean(slots.title))
const hasHoverAppend = computed(() => Boolean(slots['append-hover']))
const hasAppend = computed(() => Boolean(slots.append) || hasHoverAppend.value)
</script>

<style scoped>
.oc-bar {
  --oc-bar-min-height: var(--oc-block-md);
  --oc-bar-gap: var(--oc-space-2);
  --oc-bar-inline-padding: var(--oc-padding-standard);
  --oc-bar-inline-padding-start: var(--oc-bar-inline-padding);
  --oc-bar-inline-padding-end: var(--oc-bar-inline-padding);
  --oc-bar-fg: var(--oc-text-primary);
  min-width: 0;
  min-height: var(--oc-bar-min-height);
  display: flex;
  align-items: center;
  color: var(--oc-bar-fg);
  border: var(--oc-thickness-1) solid transparent;
  background: transparent;
  border-radius: 0;
  box-sizing: border-box;
}

.oc-bar__leading,
.oc-bar__append {
  min-width: 0;
  min-height: 0;
}

.oc-bar__leading {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--oc-bar-gap);
  padding-left: var(--oc-bar-inline-padding-start);
}

.oc-bar__icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.oc-bar__title {
  flex: 1 1 auto;
  min-width: 0;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
}

.oc-bar__append {
  margin-left: auto;
  padding-right: var(--oc-bar-inline-padding-end);
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

.oc-bar:focus-visible {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: -1px;
  position: relative;
  z-index: 1;
}
</style>
