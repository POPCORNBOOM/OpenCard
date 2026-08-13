<script setup lang="ts">
import { computed, h, type VNodeChild } from 'vue'
import {
  createProjectIconStyle,
  findProjectIcon,
  type ProjectIconCatalog,
} from '../../../features/workspace/services/projectIconCatalog'
import { parseRichTextHtml, type RichTextNode } from '../../rich-text/richTextHtml'

const props = defineProps<{
  html: string
  projectIconCatalog?: ProjectIconCatalog
}>()

const document = computed(() => parseRichTextHtml(props.html, { allowUnresolvedBindings: true }).document)

function renderNode(node: RichTextNode): VNodeChild {
  if (node.type === 'text') return node.value
  if (node.type === 'icon') {
    const entry = findProjectIcon(props.projectIconCatalog, node.seriesKey, node.iconKey)
    return entry
      ? h('span', {
          class: 'rich-text-preview__icon',
          style: createProjectIconStyle(entry),
          role: 'img',
          'aria-label': entry.name,
        })
      : h('span', { class: 'rich-text-preview__missing' }, '[icon]')
  }
  if (node.type === 'customBlock') {
    return h('span', { class: 'rich-text-preview__custom-block' }, `[${node.customBlockKey}]`)
  }
  return h(node.tag, node.attributes, node.children.map(renderNode))
}

const rendered = computed(() => document.value.children.map(renderNode))
</script>

<template>
  <span class="rich-text-preview"> <component :is="{ render: () => rendered }" /> </span>
</template>

<style scoped>
.rich-text-preview {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: pre;
}

.rich-text-preview__icon {
  display: inline-block;
  vertical-align: text-bottom;
  background-repeat: no-repeat;
}

.rich-text-preview__missing,
.rich-text-preview__custom-block {
  color: var(--oc-fg-muted);
}

.rich-text-preview :deep(p),
.rich-text-preview :deep(br) {
  display: inline;
  margin: 0;
}

.rich-text-preview :deep(p + p)::before {
  content: ' ';
}
</style>
