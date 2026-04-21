<template>
  <component :is="as" class="oc-focus-ring">
    <slot />
  </component>
</template>

<script setup lang="ts">
defineOptions({ name: 'OcFocusRing' })

withDefaults(defineProps<{
  as?: string
}>(), {
  as: 'span',
})
</script>

<style scoped>
.oc-focus-ring {
  min-width: 0;
}

.oc-focus-ring:focus-within {
  outline: 2px solid var(--oc-accent-glow);
  outline-offset: 1px;
}
</style>

