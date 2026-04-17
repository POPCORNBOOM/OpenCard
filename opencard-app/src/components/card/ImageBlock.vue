<template>
    <div :data-block-id="block.id" :style="wrapStyle" @click.stop="handleClick">
        <img :src="imageSrc" :alt="block.id" :style="imgStyle" />
    </div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { ImageBlock } from '../../core/Card'
import { useProjectStore } from '../../features/workspace/store/projectStore'
import { getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import { cardEditorContextKey } from './cardEditorContext'

const props = withDefaults(defineProps<{
    block: ImageBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

const { resolveAssetSrc } = useProjectStore()

const wrapStyle = computed(() => {
    const style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    return `${style}; overflow: hidden`
})

const imgStyle = computed(() => {
    const fit = props.block.fit
    return `width: 100%; height: 100%; object-fit: ${fit}; display: block`
})

const imageSrc = computed(() => {
    const imagePath = props.block.image
    return resolveAssetSrc(imagePath)
})

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>
