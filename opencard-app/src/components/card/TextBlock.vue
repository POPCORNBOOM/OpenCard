<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <span v-if="block.mode === 'plain'" v-text="block.content" />
        <div v-else v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import { TextBlock } from '../../core/Card'
import { getBlockBoxStyles, getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import { cardEditorContextKey } from './cardEditorContext'

const props = withDefaults(defineProps<{
    block: TextBlock
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

const blockStyle = computed(() => {
    let style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    if (props.block.fontSize) style += `; font-size: ${toCSSValue(props.block.fontSize)}`
    if (props.block.fontFamily) style += `; font-family: ${props.block.fontFamily}`
    if (props.block.fontWeight !== undefined) style += `; font-weight: ${props.block.fontWeight}`
    if (props.block.color) style += `; color: ${props.block.color}`
    if (props.block.textAlign) style += `; text-align: ${props.block.textAlign}`
    if (props.block.lineHeight !== undefined) style += `; line-height: ${toCSSValue(props.block.lineHeight)}`
    if (props.block.writingMode) style += `; writing-mode: ${props.block.writingMode}`
    return style
})

function handleClick(event: MouseEvent) {
    editorContext?.handleBlockClick?.(props.block.id, event)
}
</script>
