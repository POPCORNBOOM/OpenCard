<!-- 焦点环原语：只负责焦点可见性轮廓，不承载交互行为本身。 -->
<template>
  <component :is="as" class="oc-focus-ring">
    <slot />
  </component>
</template>

<script setup lang="ts">
defineOptions({ name: 'OcFocusRing' })

interface OcFocusRingProps {
  /** 根元素标签。 */
  as?: string
}

withDefaults(defineProps<OcFocusRingProps>(), {
  as: 'span',
})
</script>

<style scoped>
.oc-focus-ring {
  min-width: 0;
}

.oc-focus-ring:focus-within {
  outline: var(--oc-focus-ring-width) solid var(--oc-accent-glow);
  outline-offset: 1px;
}
</style>
