<!-- 文本块组件：根据块属性渲染文本内容并映射文本布局样式。 -->
<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <span v-if="block.mode === 'plain'" class="text-block-content text-block-content--plain" v-text="block.content" />
        <div v-else class="text-block-content" v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed, inject } from 'vue'
import type { TextBlock, VerticalAlignmentPosition } from '../../entities/card/model'
import { getBlockBoxStyles, getPositionStyles, toCSSValue } from '../../utils/blockStyle'
import { cardEditorContextKey } from './cardEditorContext'

const verticalJustifyMap: Record<VerticalAlignmentPosition, string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
}

const props = withDefaults(defineProps<{
    /** 文本块数据模型。 */
    block: TextBlock
    /** 布局模式：absolute 使用绝对定位，static 参与父容器流式布局。 */
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = inject(cardEditorContextKey, null)
const isTransformDisabled = computed(() =>
    editorContext?.transformDisabledBlockIds.value.has(props.block.id) ?? false
)

const blockStyle = computed(() => {
    const verticalAlign = props.block.verticalAlign ?? 'top'
    let style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    style += '; display: flex; flex-direction: column'
    style += `; justify-content: ${verticalJustifyMap[verticalAlign]}`
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

<style scoped>
.text-block-content {
    display: block;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
}

.text-block-content--plain {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
</style>
