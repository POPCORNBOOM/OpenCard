<!-- 文本块组件：根据块属性渲染文本内容并映射文本布局样式。 -->
<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <RichTextDocumentRenderer v-if="preparedRichText" class="text-block-content text-block-content--richtext"
          :prepared="preparedRichText" :owner-block="block" />
	        <div v-else class="text-block-content text-block-content--richtext" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyTextBlock } from '../render.types'
import { getTextContentBlockStyle } from './textContentBlockStyle'
import RichTextDocumentRenderer from './richTextDocumentRenderer'
import type { BlockRenderPlacement } from './blockRenderPlacement'

const props = defineProps<{
    /** 文本块数据模型。 */
    block: RenderReadyTextBlock
    placement: BlockRenderPlacement
}>()

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))
const preparedRichText = computed(() => editorContext.richText?.value.get(props.block.id) ?? null)
const blockStyle = computed(() => getTextContentBlockStyle(
    props.block,
    props.placement,
    isTransformDisabled.value,
	    value => editorContext.resources.resolveFont(value, props.block.id, 'fontFamily'),
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
.text-block-content--richtext :deep(strong),
.text-block-content--richtext :deep(b) { font-weight: 700; }
.text-block-content--richtext :deep(em),
.text-block-content--richtext :deep(i) { font-style: italic; }
.text-block-content--richtext {
    paint-order: stroke fill;
    white-space: break-spaces;
}
.text-block-content--richtext :deep(.project-inline-icon) {
    display: inline-block;
    background-repeat: no-repeat;
    vertical-align: text-bottom;
}
</style>
