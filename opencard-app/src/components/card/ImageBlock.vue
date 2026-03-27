<template>
    <div :style="wrapStyle">
        <img :src="imageSrc" :alt="block.id" :style="imgStyle" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { ImageBlock } from '../../core/Card'
import { useProjectStore } from '../../stores/projectStore'
import { getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'

const props = withDefaults(defineProps<{
    block: ImageBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const { resolveAssetSrc } = useProjectStore()

const wrapStyle = computed(() => {
    const style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block)
        : getBlockBoxStyles(props.block)
    return `${style}; overflow: hidden`
})

const imgStyle = computed(() => {
    const fit = props.block.fit ?? 'cover'
    return `width: 100%; height: 100%; object-fit: ${fit}; display: block`
})

const imageSrc = computed(() => {
    const imagePath = props.block.imagePath ?? props.block.assetId ?? ''
    return resolveAssetSrc(imagePath)
})
</script>
