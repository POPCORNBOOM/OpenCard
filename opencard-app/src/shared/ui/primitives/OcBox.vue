<template>
  <component
    :is="as"
    class="oc-box"
    :class="boxClass"
    v-bind="attrs"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
import { computed, useAttrs, type HTMLAttributes } from 'vue'

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
  class?: HTMLAttributes['class']
}>(), {
  as: 'div',
  inline: false,
  stack: false,
  center: false,
  grow: false,
  scrollY: false,
  class: undefined,
})

const attrs = useAttrs()

const boxClass = computed(() => [
  props.class,
  {
    'is-inline': props.inline,
    'is-stack': props.stack,
    'is-center': props.center,
    'is-grow': props.grow,
    'is-scroll-y': props.scrollY,
  },
])
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
</style>

