import { mergeAttributes, Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model'
import CustomBlockNodeView from './CustomBlockNodeView.vue'

export type RichTextCustomBlockLayout = 'inline' | 'block'

export function remapPastedEmbedIds(slice: Slice): Slice {
  const rewrite = (node: ProseMirrorNode): ProseMirrorNode => {
    const content: ProseMirrorNode[] = []
    node.content.forEach(child => content.push(rewrite(child)))
    const isEmbed = node.type.name === 'inlineCustomBlock' || node.type.name === 'blockCustomBlock'
    return node.type.create(isEmbed ? { ...node.attrs, embedId: crypto.randomUUID() } : node.attrs, content, node.marks)
  }
  const children: ProseMirrorNode[] = []
  slice.content.forEach(node => children.push(rewrite(node)))
  return new Slice(Fragment.fromArray(children), slice.openStart, slice.openEnd)
}

function parseProperties(element: HTMLElement): Record<string, string> {
  return Object.fromEntries(Array.from(element.children).flatMap(child => {
    if (child.tagName !== 'OC-PROP') return []
    const key = child.getAttribute('data-oc-key')?.trim() ?? ''
    return key ? [[key, child.textContent ?? '']] : []
  }))
}

export function createCustomBlockNode(layout: RichTextCustomBlockLayout) {
  const inline = layout === 'inline'
  return Node.create({
    name: inline ? 'inlineCustomBlock' : 'blockCustomBlock',
    group: inline ? 'inline' : 'block',
    inline,
    atom: true,
    selectable: true,
    draggable: true,
    marks: inline ? '_' : '',
    addAttributes() {
      return {
        embedId: { default: '' },
        customBlockKey: { default: '' },
        properties: { default: {} },
      }
    },
    parseHTML() {
      return [{
        tag: `oc-custom-block[data-oc-layout="${layout}"]`,
        getAttrs: element => element instanceof HTMLElement ? {
          embedId: element.getAttribute('data-oc-id') ?? '',
          customBlockKey: element.getAttribute('data-oc-key') ?? '',
          properties: parseProperties(element),
        } : false,
      }]
    },
    renderHTML({ node, HTMLAttributes }) {
      const properties = Object.entries(node.attrs.properties as Record<string, string>)
        .map(([key, value]) => ['oc-prop', { 'data-oc-key': key }, value])
      const { embedId: _embedId, customBlockKey: _customBlockKey, properties: _properties, ...safeAttributes } = HTMLAttributes
      return ['oc-custom-block', mergeAttributes(safeAttributes, {
        'data-oc-id': node.attrs.embedId,
        'data-oc-key': node.attrs.customBlockKey,
        'data-oc-layout': layout,
      }), ...properties]
    },
    renderText({ node }) { return `[${String(node.attrs.customBlockKey)}]` },
    addNodeView() { return VueNodeViewRenderer(CustomBlockNodeView) },
  })
}

export const InlineCustomBlockNode = createCustomBlockNode('inline')
export const BlockCustomBlockNode = createCustomBlockNode('block')
