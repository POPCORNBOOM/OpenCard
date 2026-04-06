<template>
  <TextBlock v-if="block.type === 'text-block'" :block="block" :layout-mode="layoutMode" />
  <ImageBlock v-else-if="block.type === 'image-block'" :block="block" :layout-mode="layoutMode" />
  <SimpleContainerBlock
    v-else-if="block.type === 'simple-container-block'"
    :block="block"
    :layout-mode="layoutMode"
  />
  <FlowContainerBlock
    v-else-if="block.type === 'flow-container-block'"
    :block="block"
    :layout-mode="layoutMode"
  />
</template>

<script setup lang="ts">
import { CardBlock } from '../../core/Card'
import FlowContainerBlock from './FlowContainerBlock.vue'
import ImageBlock from './ImageBlock.vue'
import SimpleContainerBlock from './SimpleContainerBlock.vue'
import TextBlock from './TextBlock.vue'

withDefaults(defineProps<{
  block: CardBlock
  layoutMode?: 'absolute' | 'static'
}>(), {
  layoutMode: 'absolute',
})
</script>
