<!-- 文本块组件：根据块属性渲染文本内容并映射文本布局样式。 -->
<template>
    <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
        <span v-if="block.mode === 'plain'" class="text-block-content text-block-content--plain" v-text="block.content" />
        <div v-else-if="block.mode === 'markdown'" class="text-block-content text-block-content--markdown"
            v-html="markdownContent" />
        <div v-else class="text-block-content text-block-content--richtext" v-html="block.content" />
    </div>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { getBlockBoxStyles, getPositionStyles } from '../../../utils/blockStyle'
import { useCardEditorContext } from './cardEditorContext'
import type { RenderReadyTextBlock } from '../render.types'
import { renderMarkdown } from '../markdown/renderMarkdown'

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
const markdownContent = computed(() => renderMarkdown(props.block.content, {
    resolveImageSrc: editorContext.resolveAssetSrc,
}))

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

.text-block-content--plain {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.text-block-content--markdown {
    overflow-wrap: anywhere;
}

.text-block-content--markdown :deep(> :first-child) {
    margin-block-start: 0;
}

.text-block-content--markdown :deep(> :last-child) {
    margin-block-end: 0;
}

.text-block-content--markdown :deep(p) {
    margin: 0 0 0.55em;
}

.text-block-content--markdown :deep(h1),
.text-block-content--markdown :deep(h2),
.text-block-content--markdown :deep(h3),
.text-block-content--markdown :deep(h4),
.text-block-content--markdown :deep(h5),
.text-block-content--markdown :deep(h6) {
    margin: 0.65em 0 0.3em;
    font-weight: 700;
    line-height: 1.2;
}

.text-block-content--markdown :deep(h1) { font-size: 1.5em; }
.text-block-content--markdown :deep(h2) { font-size: 1.32em; }
.text-block-content--markdown :deep(h3) { font-size: 1.18em; }
.text-block-content--markdown :deep(h4),
.text-block-content--markdown :deep(h5),
.text-block-content--markdown :deep(h6) { font-size: 1em; }

.text-block-content--markdown :deep(ul),
.text-block-content--markdown :deep(ol) {
    margin: 0.4em 0;
    padding-inline-start: 1.5em;
}

.text-block-content--markdown :deep(li + li) {
    margin-block-start: 0.18em;
}

.text-block-content--markdown :deep(blockquote) {
    margin: 0.5em 0;
    padding-inline-start: 0.75em;
    border-inline-start: 0.18em solid currentColor;
    opacity: 0.78;
}

.text-block-content--markdown :deep(code),
.text-block-content--markdown :deep(pre) {
    font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
}

.text-block-content--markdown :deep(code) {
    padding: 0.08em 0.24em;
    border-radius: 2px;
    background: color-mix(in srgb, currentColor 10%, transparent);
}

.text-block-content--markdown :deep(pre) {
    margin: 0.5em 0;
    padding: 0.55em 0.65em;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
    background: color-mix(in srgb, currentColor 7%, transparent);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.text-block-content--markdown :deep(pre code) {
    padding: 0;
    background: transparent;
}

.text-block-content--markdown :deep(a) {
    color: inherit;
    text-decoration: underline;
    text-underline-offset: 0.12em;
}

.text-block-content--markdown :deep(.text-block-markdown-image) {
    display: inline-block;
    max-width: 100%;
    height: auto;
    vertical-align: middle;
}

.text-block-content--markdown :deep(table) {
    width: 100%;
    margin: 0.5em 0;
    border-collapse: collapse;
    table-layout: fixed;
}

.text-block-content--markdown :deep(th),
.text-block-content--markdown :deep(td) {
    padding: 0.22em 0.35em;
    border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
    vertical-align: top;
    overflow-wrap: anywhere;
}

.text-block-content--markdown :deep(hr) {
    margin: 0.6em 0;
    border: 0;
    border-top: 1px solid color-mix(in srgb, currentColor 30%, transparent);
}
</style>
