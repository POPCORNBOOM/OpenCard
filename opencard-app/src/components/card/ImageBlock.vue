<template>
    <img :src="block.assetId" :alt="block.id" />
</template>
<script setup lang="ts">
import { ImageBlock } from '../../core/cardDocument';


defineProps<{
    block: ImageBlock
}>()
</script>