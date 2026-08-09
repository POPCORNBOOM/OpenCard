<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <div v-for="child in block.children" :key="child.block.id" :style="getChildStyle(child)">
            <CardBlockRenderer :block="getChildRenderBlock(child)" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getAbsolutePositionStyles, getBlockBoxStyles, getPositionStyles } from '../../../utils/blockStyle'
import CardBlockRenderer from './CardBlockRenderer.vue'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyCardBlock, RenderReadySimpleContainerBlock } from '../render.types'

const props = withDefaults(defineProps<{
    block: RenderReadySimpleContainerBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))

const blockStyle = computed(() => {
    const style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    return `${style}; position: relative; overflow: ${props.block.clip ? 'hidden' : 'visible'}`
})

function getChildStyle(child: RenderReadySimpleContainerBlock['children'][number]) {
    return `position: absolute; ${getAbsolutePositionStyles(child.location)}; z-index: ${child.block.zIndex}; width: ${child.block.width}; height: ${child.block.height}`
}

function getChildRenderBlock(child: RenderReadySimpleContainerBlock['children'][number]): RenderReadyCardBlock {
    return {
        ...child.block,
        width: '100%',
        height: '100%',
    }
}

function handleClick(event: MouseEvent) {
    editorContext.handleBlockClick(props.block.id, event)
}
</script>
