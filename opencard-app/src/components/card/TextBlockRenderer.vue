<!-- 文本块组件：根据块属性渲染文本内容并映射文本布局样式。 -->
<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <span v-if="block.mode === 'plain'" class="text-block-content text-block-content--plain" v-text="block.content" />
        <div v-else class="text-block-content" v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { getBlockBoxStyles, getPositionStyles } from '../../utils/blockStyle'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyTextBlock } from './render.types'

const verticalJustifyMap: Record<RenderReadyTextBlock['verticalAlign'], string> = {
    top: 'flex-start',
    center: 'center',
    bottom: 'flex-end',
}

const props = withDefaults(defineProps<{
    /** 文本块数据模型。 */
    block: RenderReadyTextBlock
    /** 布局模式：absolute 使用绝对定位，static 参与父容器流式布局。 */
    layoutMode?: 'absolute' | 'static'
}>(), {
    layoutMode: 'absolute',
})

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))

const blockStyle = computed(() => {
    let style = props.layoutMode === 'absolute'
        ? getPositionStyles(props.block, { disableTransform: isTransformDisabled.value })
        : getBlockBoxStyles(props.block, { disableTransform: isTransformDisabled.value })
    style += '; display: flex; flex-direction: column'
    style += `; justify-content: ${verticalJustifyMap[props.block.verticalAlign]}`
    style += `; font-size: ${props.block.fontSize}`
    style += `; font-family: ${props.block.fontFamily}`
    style += `; font-weight: ${props.block.fontWeight}`
    style += `; color: ${props.block.color}`
    style += `; text-align: ${props.block.textAlign}`
    style += `; line-height: ${props.block.lineHeight}`
    style += `; writing-mode: ${props.block.writingMode}`
    return style
})

function handleClick(event: MouseEvent) {
    editorContext.handleBlockClick(props.block.id, event)
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
