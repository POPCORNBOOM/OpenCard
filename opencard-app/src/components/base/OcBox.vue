<!-- Base 布局容器：独立实现空间、定位与流式排列能力，不依赖 shared primitives。 -->
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
import { computed, useAttrs } from 'vue'
import {
  OC_BOX_ALIGN_VALUES,
  OC_BOX_DIMENSION_TOKENS,
  OC_BOX_INSET_TOKENS,
  OC_BOX_JUSTIFY_VALUES,
  OC_BOX_OVERFLOW_VALUES,
  OC_BOX_POINTER_VALUES,
} from '../../shared/ui/foundation/tokenRegistry'

type OcBoxDimensionToken = (typeof OC_BOX_DIMENSION_TOKENS)[number]
type OcBoxInsetToken = (typeof OC_BOX_INSET_TOKENS)[number]
type OcBoxPointer = (typeof OC_BOX_POINTER_VALUES)[number]
type OcBoxAlign = (typeof OC_BOX_ALIGN_VALUES)[number]
type OcBoxJustify = (typeof OC_BOX_JUSTIFY_VALUES)[number]
type OcBoxOverflow = (typeof OC_BOX_OVERFLOW_VALUES)[number]

interface OcBoxProps {
  /** 根元素标签。 */
  as?: string
  /** 是否使用横向 flex 对齐。 */
  inline?: boolean
  /** 是否使用纵向堆叠布局。 */
  stack?: boolean
  /** 是否在主轴和交叉轴居中。 */
  center?: boolean
  /** 是否在 flex 容器中自动拉伸。 */
  grow?: boolean
  /** 是否启用纵向滚动。 */
  scrollY?: boolean
  /** 是否铺满父容器。 */
  fill?: boolean
  /** 是否启用相对定位。 */
  relative?: boolean
  /** 是否启用绝对定位。 */
  absolute?: boolean
  /** inset 位置 token。 */
  inset?: OcBoxInsetToken
  /** 宽度 token。 */
  width?: OcBoxDimensionToken
  /** 高度 token。 */
  height?: OcBoxDimensionToken
  /** pointer-events 语义 token。 */
  pointer?: OcBoxPointer
  /** 交叉轴对齐 token。 */
  align?: OcBoxAlign
  /** 主轴对齐 token。 */
  justify?: OcBoxJustify
  /** 溢出行为 token。 */
  overflow?: OcBoxOverflow
}

defineOptions({
  name: 'OcBox',
  inheritAttrs: false,
})

const props = withDefaults(defineProps<OcBoxProps>(), {
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
const forwardedAttrs = computed(() => {
  const { class: _class, ...restAttrs } = attrs
  return restAttrs
})

const boxClass = computed(() => [
  `oc-box--width-${props.width}`,
  `oc-box--height-${props.height}`,
  `oc-box--inset-${props.inset}`,
  `oc-box--pointer-${props.pointer}`,
  `oc-box--align-${props.align}`,
  `oc-box--justify-${props.justify}`,
  `oc-box--overflow-${props.overflow}`,
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
