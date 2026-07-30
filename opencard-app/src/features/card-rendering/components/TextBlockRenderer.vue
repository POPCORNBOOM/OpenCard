<!-- 文本块组件：根据块属性渲染文本内容并映射文本布局样式。 -->
<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <div class="text-block-content text-block-content--richtext" v-html="richTextContent" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyTextBlock } from '../render.types'
import { normalizeRichTextHtml } from '../../../shared/rich-text/richTextHtml'
import { getTextContentBlockStyle } from './textContentBlockStyle'

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
const richTextContent = computed(() => normalizeRichTextHtml(props.block.content))
const blockStyle = computed(() => getTextContentBlockStyle(
    props.block,
    props.layoutMode,
    isTransformDisabled.value,
))

function handleClick(event: MouseEvent) {
    if (event.target instanceof Element && event.target.closest('a')) {
        event.preventDefault()
    }
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

.text-block-content--richtext :deep(p) { margin: 0; }
.text-block-content--richtext :deep(p + p) { margin-top: 0.35em; }
.text-block-content--richtext {
    paint-order: stroke fill;
    white-space: break-spaces;
}
</style>
