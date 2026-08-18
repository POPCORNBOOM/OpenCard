<!-- Markdown 文本块：解析 Markdown 源码并映射共享文字排版样式。 -->
<template>
  <div :data-block-id="block.id" :style="blockStyle" @click.stop="handleClick">
    <div class="markdown-text-block-content" v-html="markdownContent" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RenderReadyMarkdownTextBlock } from '../render.types'
import { renderMarkdown } from '../markdown/renderMarkdown'
import { useCardEditorContext } from './cardEditorContext'
import { getTextContentBlockStyle } from './textContentBlockStyle'
import { EMPTY_PROJECT_ICON_CATALOG } from '../../workspace/services/projectIconCatalog'

const props = withDefaults(defineProps<{
  block: RenderReadyMarkdownTextBlock
  layoutMode?: 'absolute' | 'static'
}>(), {
  layoutMode: 'absolute',
})

const editorContext = useCardEditorContext()
const isTransformDisabled = computed(() => editorContext.transformDisabledBlockIds.value.has(props.block.id))
const markdownContent = computed(() => renderMarkdown(props.block.content, {
  resolveImageSrc: editorContext.resolveAssetSrc,
  projectIconCatalog: editorContext.projectIconCatalog?.value ?? EMPTY_PROJECT_ICON_CATALOG,
}))
const blockStyle = computed(() => getTextContentBlockStyle(
  props.block,
  props.layoutMode,
  isTransformDisabled.value,
  editorContext.resolveFontFamily,
))

function handleClick(event: MouseEvent): void {
  if (event.target instanceof Element && event.target.closest('a')) event.preventDefault()
  editorContext.handleBlockClick(props.block.id, event)
}
</script>

<style scoped>
.markdown-text-block-content {
  display: block;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-wrap: anywhere;
}

.markdown-text-block-content :deep(> :first-child) { margin-block-start: 0; }
.markdown-text-block-content :deep(> :last-child) { margin-block-end: 0; }
.markdown-text-block-content :deep(p) { margin: 0 0 0.55em; }

.markdown-text-block-content :deep(h1),
.markdown-text-block-content :deep(h2),
.markdown-text-block-content :deep(h3),
.markdown-text-block-content :deep(h4),
.markdown-text-block-content :deep(h5),
.markdown-text-block-content :deep(h6) {
  margin: 0.65em 0 0.3em;
  font-weight: 700;
  line-height: 1.2;
}

.markdown-text-block-content :deep(h1) { font-size: 1.5em; }
.markdown-text-block-content :deep(h2) { font-size: 1.32em; }
.markdown-text-block-content :deep(h3) { font-size: 1.18em; }
.markdown-text-block-content :deep(h4),
.markdown-text-block-content :deep(h5),
.markdown-text-block-content :deep(h6) { font-size: 1em; }

.markdown-text-block-content :deep(ul),
.markdown-text-block-content :deep(ol) {
  margin: 0.4em 0;
  padding-inline-start: 1.5em;
}

.markdown-text-block-content :deep(li + li) { margin-block-start: 0.18em; }

.markdown-text-block-content :deep(blockquote) {
  margin: 0.5em 0;
  padding-inline-start: 0.75em;
  border-inline-start: 0.18em solid currentColor;
  opacity: 0.78;
}

.markdown-text-block-content :deep(code),
.markdown-text-block-content :deep(pre) {
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
}

.markdown-text-block-content :deep(code) {
  padding: 0.08em 0.24em;
  border-radius: 2px;
  background: color-mix(in srgb, currentColor 10%, transparent);
}

.markdown-text-block-content :deep(pre) {
  margin: 0.5em 0;
  padding: 0.55em 0.65em;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  background: color-mix(in srgb, currentColor 7%, transparent);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.markdown-text-block-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-text-block-content :deep(a) {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.12em;
}

.markdown-text-block-content :deep(.text-block-markdown-image) {
  display: inline-block;
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}

.markdown-text-block-content :deep(.project-inline-icon) {
  display: inline-block;
  background-repeat: no-repeat;
  vertical-align: text-bottom;
}

.markdown-text-block-content :deep(table) {
  width: 100%;
  margin: 0.5em 0;
  border-collapse: collapse;
  table-layout: fixed;
}

.markdown-text-block-content :deep(th),
.markdown-text-block-content :deep(td) {
  padding: 0.22em 0.35em;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  vertical-align: top;
  overflow-wrap: anywhere;
}

.markdown-text-block-content :deep(hr) {
  margin: 0.6em 0;
  border: 0;
  border-top: 1px solid color-mix(in srgb, currentColor 30%, transparent);
}
</style>
