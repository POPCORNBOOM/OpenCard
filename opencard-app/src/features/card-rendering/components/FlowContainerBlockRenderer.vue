<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <div v-for="child in orderedChildren" :key="child.block.id" :style="getChildStyle(child)">
            <CardBlockRenderer :block="getChildRenderBlock(child)" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getBlockBoxStyles, getPositionStyles } from '../../../utils/blockStyle'
import CardBlockRenderer from './CardBlockRenderer.vue'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyCardBlock, RenderReadyFlowContainerBlock } from '../render.types'

const props = withDefaults(defineProps<{
    block: RenderReadyFlowContainerBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))

const directionMap: Record<RenderReadyFlowContainerBlock['direction'], string> = {
    lr: 'row',
    rl: 'row-reverse',
    tb: 'column',
    bt: 'column-reverse',
}

const alignMap: Record<RenderReadyFlowContainerBlock['children'][number]['location']['align'], string> = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    justify: 'stretch',
}

const blockStyle = computed(() => {
    const pos = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    const flexDir = directionMap[props.block.direction]
    return `${pos}; display: flex; flex-direction: ${flexDir}; gap: ${props.block.gap}; overflow: ${props.block.clip ? 'hidden' : 'visible'}`
})

const orderedChildren = computed(() =>
    [...props.block.children].sort((a, b) => a.location.index - b.location.index)
)

function getChildStyle(child: RenderReadyFlowContainerBlock['children'][number]) {
    return [
        `order: ${child.location.index}`,
        `width: ${child.block.width}`,
        `height: ${child.block.height}`,
        'flex-shrink: 0',
        `align-self: ${alignMap[child.location.align]}`,
        `z-index: ${child.block.zIndex}`,
    ].join('; ')
}

function getChildRenderBlock(child: RenderReadyFlowContainerBlock['children'][number]): RenderReadyCardBlock {
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
