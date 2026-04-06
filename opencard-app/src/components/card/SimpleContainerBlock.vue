<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <div v-for="child in block.children" :key="child.block.id" :style="getChildStyle(child)">
            <CardBlock :block="child.block" layout-mode="static" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { SimpleContainerBlock } from '../../core/Card'
import { getAbsolutePositionStyles, getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import CardBlock from './CardBlock.vue'
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
    return `position: absolute; ${getAbsolutePositionStyles(child.location)}${zIndex}`
}

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>
