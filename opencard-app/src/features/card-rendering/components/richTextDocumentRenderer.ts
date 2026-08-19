import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import type { RichTextNode } from '../../../shared/rich-text/richTextHtml'
import { createProjectIconStyle, findProjectIcon } from '../../workspace/services/projectIconCatalog'
import type { PreparedRichText } from '../prepareRichText'
import { useCardEditorContext } from './cardEditorContext'
import CardBlockRenderer from './CardBlockRenderer.vue'
import OcIcon from '../../../components/base/OcIcon.vue'
import type { RenderReadyCustomBlock } from '../render.types'

export default defineComponent({
  name: 'RichTextDocumentRenderer',
  props: {
    prepared: { type: Object as PropType<PreparedRichText>, required: true },
  },
  setup(props) {
    const context = useCardEditorContext()
    function renderNode(node: RichTextNode): VNodeChild {
      if (node.type === 'text') return node.value
      if (node.type === 'icon') {
        const entry = findProjectIcon(context.projectIconCatalog?.value, node.seriesKey, node.iconKey)
        return entry
          ? h('span', { class: 'project-inline-icon oc-project-icon', style: createProjectIconStyle(entry), role: 'img', 'aria-label': entry.name })
          : h(OcIcon, { name: 'status.warning', tone: 'warning', size: 'md' })
      }
      if (node.type === 'customBlock') {
        const block = props.prepared.embeddedBlocks.get(node.embedId)
        return h('div', { class: `rich-text-custom-block rich-text-custom-block--${node.layout}` }, block
          ? [h(CardBlockRenderer, { block: block as RenderReadyCustomBlock, layoutMode: 'static' })]
          : [h(OcIcon, { name: 'status.warning', tone: 'warning', size: 'md' })])
      }
      return h(node.tag, node.attributes, node.children.map(renderNode))
    }
    return () => props.prepared.valid
      ? h('div', { class: 'rich-text-document' }, props.prepared.document.children.map(renderNode))
      : h('div', { class: 'rich-text-document rich-text-document--invalid' }, [
          h(OcIcon, { name: 'status.warning', tone: 'warning', size: 'md' }),
        ])
  },
})
