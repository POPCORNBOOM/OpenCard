<template>
  <CustomBlockRenderer v-if="block.type === 'custom-block'" :block="block" :layout-mode="layoutMode" />
  <NativeBlockRenderer v-else :block="block" :layout-mode="layoutMode" />
</template>

<script setup lang="ts">
import type { RenderReadyCardBlock } from '../render.types'
import CustomBlockRenderer from './CustomBlockRenderer.vue'
import NativeBlockRenderer from './NativeBlockRenderer.vue'

withDefaults(defineProps<{
  block: RenderReadyCardBlock
  layoutMode?: 'absolute' | 'static'
}>(), {
  layoutMode: 'absolute',
})
</script>
