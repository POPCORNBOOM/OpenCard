<template>
  <TextBlock v-if="block.type === 'text'" :block="block" />
  <ImageBlock v-else-if="block.type === 'image'" :block="block" />
  <SimpleContainerBlock v-else-if="block.type === 'simple-container'" :block="block" />
</template>
<script setup lang="ts">
import { CardBlock } from '../../core/cardDocument';
import TextBlock from './TextBlock.vue';
import ImageBlock from './ImageBlock.vue';
import SimpleContainerBlock from './SimpleContainerBlock.vue';

defineProps<{
  block: CardBlock
}>()
</script>