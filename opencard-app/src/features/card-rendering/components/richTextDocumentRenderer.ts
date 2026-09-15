import { defineComponent, h, type PropType, type VNodeChild } from 'vue'
import type { RichTextNode } from '../../../shared/rich-text/richTextHtml'
import { formatProjectIconPath } from '../../../shared/rich-text/projectIconReference'
import type { RenderReadyTextBlock } from '../render.types'
import type { PreparedRichText } from '../prepareRichText'
import { useCardEditorContext } from './cardEditorContext'
import OcIcon from '../../../components/base/OcIcon.vue'
import ProjectIconGraphic from './ProjectIconGraphic.vue'

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
        const resource = context.resources.resolve({
          value: formatProjectIconPath({
            packageKey: node.packageKey,
            seriesKey: node.seriesKey,
            iconKey: node.iconKey,
          }),
          expect: 'asset',
          blockId: props.ownerBlock.id,
          fieldKey: 'content',
        })
        const entry = resource.kind === 'icon' ? resource.entry : null
        return entry
          ? h(ProjectIconGraphic, {
              class: 'project-inline-icon',
              entry,
              mode: 'inline',
              readDimensions: context.resources.resolveIconDimensions,
            })
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
