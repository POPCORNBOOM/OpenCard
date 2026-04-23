<template>
  <component
    :is="as"
    class="oc-box"
    :class="boxClass"
    :style="boxStyle"
    v-bind="attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs, type CSSProperties, type HTMLAttributes } from 'vue'

defineOptions({
  name: 'OcBox',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<{
  as?: string
  inline?: boolean
  stack?: boolean
  center?: boolean
  grow?: boolean
  scrollY?: boolean
  fill?: boolean
  relative?: boolean
  absolute?: boolean
  inset?: string
  width?: string
  height?: string
  pointer?: 'auto' | 'none'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
  overflow?: 'visible' | 'hidden' | 'auto'
  class?: HTMLAttributes['class']
}>(), {
  as: 'div',
  inline: false,
  stack: false,
  center: false,
  grow: false,
  scrollY: false,
  fill: false,
  relative: false,
  absolute: false,
  inset: undefined,
  width: undefined,
  height: undefined,
  pointer: undefined,
  align: undefined,
  justify: undefined,
  overflow: undefined,
  class: undefined,
})

const attrs = useAttrs()

function mapAlign(align: NonNullable<typeof props.align>): CSSProperties['alignItems'] {
  if (align === 'start') return 'flex-start'
  if (align === 'end') return 'flex-end'
  return align
}

function mapJustify(justify: NonNullable<typeof props.justify>): CSSProperties['justifyContent'] {
  if (justify === 'start') return 'flex-start'
  if (justify === 'end') return 'flex-end'
  if (justify === 'between') return 'space-between'
  return justify
}

const boxClass = computed(() => [
  props.class,
  {
    'is-inline': props.inline,
    'is-stack': props.stack,
    'is-center': props.center,
    'is-grow': props.grow,
    'is-scroll-y': props.scrollY,
    'is-fill': props.fill,
    'is-relative': props.relative,
    'is-absolute': props.absolute,
  },
])

const boxStyle = computed<CSSProperties>(() => ({
  ...(props.width ? { width: props.width } : {}),
  ...(props.height ? { height: props.height } : {}),
  ...(props.inset ? { inset: props.inset } : {}),
  ...(props.pointer ? { pointerEvents: props.pointer } : {}),
  ...(props.align ? { alignItems: mapAlign(props.align) } : {}),
  ...(props.justify ? { justifyContent: mapJustify(props.justify) } : {}),
  ...(props.overflow ? { overflow: props.overflow } : {}),
}))
</script>

<style scoped>
.oc-box {
  min-width: 0;
  min-height: 0;
}

.oc-box.is-inline {
  display: flex;
  align-items: center;
}

.oc-box.is-stack {
  display: flex;
  flex-direction: column;
}

.oc-box.is-center {
  align-items: center;
  justify-content: center;
}

.oc-box.is-grow {
  flex: 1;
}

.oc-box.is-scroll-y {
  overflow-y: auto;
}

.oc-box.is-fill {
  width: 100%;
  height: 100%;
}

.oc-box.is-relative {
  position: relative;
}

.oc-box.is-absolute {
  position: absolute;
}
</style>
