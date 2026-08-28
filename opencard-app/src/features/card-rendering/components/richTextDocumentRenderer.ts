import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import type { RichTextNode } from '../../../shared/rich-text/richTextHtml'
import type { RenderReadyTextBlock } from '../render.types'
import { createProjectIconStyle } from '../../workspace/services/projectIconCatalog'
import type { PreparedRichText } from '../prepareRichText'
import { useCardEditorContext } from './cardEditorContext'
import OcIcon from '../../../components/base/OcIcon.vue'

export default defineComponent({
  name: 'RichTextDocumentRenderer',
  props: {
    prepared: { type: Object as PropType<PreparedRichText>, required: true },
    ownerBlock: { type: Object as PropType<RenderReadyTextBlock>, required: true },
  },
  setup(props) {
    const context = useCardEditorContext()
    function renderNode(node: RichTextNode): VNodeChild {
      if (node.type === 'text') return node.value
      if (node.type === 'icon') {
        const entry = context.resources.resolveIcon(`icon:${node.seriesKey}/${node.iconKey}`, props.ownerBlock.id, 'content')
        return entry
          ? h('span', { class: 'project-inline-icon oc-project-icon', style: createProjectIconStyle(entry), role: 'img', 'aria-label': entry.name })
          : h(OcIcon, { name: 'status.warning', tone: 'warning', size: 'md' })
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
