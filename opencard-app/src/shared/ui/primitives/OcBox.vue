<template>
  <component
    :is="as"
    class="oc-box"
    :class="boxClass"
    v-bind="forwardedAttrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { useAttrs } from 'vue'
import {
  useOcBoxCapabilities,
  type OcBoxAlign,
  type OcBoxDimensionToken,
  type OcBoxInsetToken,
  type OcBoxJustify,
  type OcBoxOverflow,
  type OcBoxPointer,
} from '../composables/useOcBoxCapabilities'
import { useOcForwardAttrs } from '../composables/useOcCapabilityClasses'

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
  inset?: OcBoxInsetToken
  width?: OcBoxDimensionToken
  height?: OcBoxDimensionToken
  pointer?: OcBoxPointer
  align?: OcBoxAlign
  justify?: OcBoxJustify
  overflow?: OcBoxOverflow
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
  inset: 'none',
  width: 'auto',
  height: 'auto',
  pointer: 'auto',
  align: 'start',
  justify: 'start',
  overflow: 'visible',
})

const attrs = useAttrs()
const forwardedAttrs = useOcForwardAttrs(attrs)
const { boxClass } = useOcBoxCapabilities({
  inline: props.inline,
  stack: props.stack,
  center: props.center,
  grow: props.grow,
  scrollY: props.scrollY,
  fill: props.fill,
  relative: props.relative,
  absolute: props.absolute,
  inset: props.inset,
  width: props.width,
  height: props.height,
  pointer: props.pointer,
  align: props.align,
  justify: props.justify,
  overflow: props.overflow,
})
</script>

<style scoped>
.oc-box {
  min-width: 0;
  min-height: 0;
}

.oc-box--width-auto {
  width: auto;
}

.oc-box--width-content {
  width: fit-content;
}

.oc-box--width-full {
  width: 100%;
}

.oc-box--width-screen {
  width: 100vw;
}

.oc-box--height-auto {
  height: auto;
}

.oc-box--height-content {
  height: fit-content;
}

.oc-box--height-full {
  height: 100%;
}

.oc-box--height-screen {
  height: 100vh;
}

.oc-box--inset-none {
  inset: auto;
}

.oc-box--inset-cover {
  inset: 0;
}

.oc-box--inset-origin {
  inset: 0 auto auto 0;
}

.oc-box--pointer-auto {
  pointer-events: auto;
}

.oc-box--pointer-none {
  pointer-events: none;
}

.oc-box--align-start {
  align-items: flex-start;
}

.oc-box--align-center {
  align-items: center;
}

.oc-box--align-end {
  align-items: flex-end;
}

.oc-box--align-stretch {
  align-items: stretch;
}

.oc-box--justify-start {
  justify-content: flex-start;
}

.oc-box--justify-center {
  justify-content: center;
}

.oc-box--justify-end {
  justify-content: flex-end;
}

.oc-box--justify-between {
  justify-content: space-between;
}

.oc-box--overflow-visible {
  overflow: visible;
}

.oc-box--overflow-hidden {
  overflow: hidden;
}

.oc-box--overflow-auto {
  overflow: auto;
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
