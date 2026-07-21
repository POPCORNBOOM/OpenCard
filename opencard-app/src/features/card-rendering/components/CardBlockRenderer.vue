<template>
  <TextBlockRenderer v-if="block.type === 'text-block'" :block="block" :layout-mode="layoutMode" />
  <ImageBlockRenderer v-else-if="block.type === 'image-block'" :block="block" :layout-mode="layoutMode" />
  <QRCodeBlockRenderer v-else-if="block.type === 'qrcode-block'" :block="block" :layout-mode="layoutMode" />
  <ShapeBlockRenderer v-else-if="block.type === 'shape-block'" :block="block" :layout-mode="layoutMode" />
  <SimpleContainerBlockRenderer
    v-else-if="block.type === 'simple-container-block'"
    :block="block"
    :layout-mode="layoutMode"
  />
  <FlowContainerBlockRenderer
    v-else-if="block.type === 'flow-container-block'"
    :block="block"
    :layout-mode="layoutMode"
  />
</template>

<script setup lang="ts">
import type { RenderReadyCardBlock } from '../render.types'
import FlowContainerBlockRenderer from './FlowContainerBlockRenderer.vue'
import ImageBlockRenderer from './ImageBlockRenderer.vue'
import QRCodeBlockRenderer from './QRCodeBlockRenderer.vue'
import ShapeBlockRenderer from './ShapeBlockRenderer.vue'
import SimpleContainerBlockRenderer from './SimpleContainerBlockRenderer.vue'
import TextBlockRenderer from './TextBlockRenderer.vue'

withDefaults(defineProps<{
  block: RenderReadyCardBlock
  layoutMode?: 'absolute' | 'static'
}>(), {
  layoutMode: 'absolute',
})
</script>
