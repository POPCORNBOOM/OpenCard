<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <div v-for="child in block.children" :key="child.block.id" :style="getChildStyle(child)">
            <CardBlockRenderer :block="getChildRenderBlock(child)" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { CardBlock as CardBlockModel, SimpleContainerBlock } from '../../entities/card/model'
import { getAbsolutePositionStyles, getBlockBoxStyles, getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import CardBlockRenderer from './CardBlockRenderer.vue'
import { cardEditorContextKey } from './cardEditorContext'

const props = withDefaults(defineProps<{
    block: SimpleContainerBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

const blockStyle = computed(() => {
    const style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    return `${style}; position: relative`
})

function getChildStyle(child: SimpleContainerBlock['children'][number]) {
    const zIndex = child.block.zIndex !== undefined ? `; z-index: ${child.block.zIndex}` : ''
    const width = child.block.width !== undefined ? `; width: ${toCSSValue(child.block.width)}` : ''
    const height = child.block.height !== undefined ? `; height: ${toCSSValue(child.block.height)}` : ''
    return `position: absolute; ${getAbsolutePositionStyles(child.location)}${zIndex}${width}${height}`
}

function getChildRenderBlock(child: SimpleContainerBlock['children'][number]): CardBlockModel {
    const { block } = child
    const hasWidth = block.width !== undefined
    const hasHeight = block.height !== undefined

    if (!hasWidth && !hasHeight) {
        return block
    }

    return {
        ...block,
        width: hasWidth ? '100%' : block.width,
        height: hasHeight ? '100%' : block.height,
    } as CardBlockModel
}

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>
