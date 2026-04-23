<template>
  <OcIcon
    :name="name"
    :size="size"
    :color="color"
    :tone="tone"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import type { IconDefinition, IconName } from '../../shared/ui/icon/iconRegistry'
import OcIcon from '../../shared/ui/primitives/OcIcon.vue'

defineOptions({
  name: 'AppIcon',
  inheritAttrs: false,
})

defineProps<{
  name?: IconName | string | { icon?: IconName | string } | IconDefinition
  size?: number | string
  color?: string
  tone?: string
}>()
</script>
