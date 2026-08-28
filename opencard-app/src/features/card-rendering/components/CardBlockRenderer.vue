<template>
  <NativeBlockRenderer :block="block" :placement="placement" />
</template>

<script setup lang="ts">
import type { RenderReadyCardBlock } from '../render.types'
import NativeBlockRenderer from './NativeBlockRenderer.vue'
import type { BlockRenderPlacement } from './blockRenderPlacement'

defineProps<{
  block: RenderReadyCardBlock
  placement: BlockRenderPlacement
}>()
</script>
