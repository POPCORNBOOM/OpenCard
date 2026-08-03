import { mergeAttributes, Node, nodeInputRule, nodePasteRule } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import type { ProjectIconCatalog } from '../../../features/workspace/services/projectIconCatalog'
import ProjectIconNodeView from './ProjectIconNodeView.vue'

const keyPattern = /^[a-z0-9][a-z0-9._-]*$/

export type ProjectIconNodeOptions = {
  catalog?: () => ProjectIconCatalog | undefined
}

export const ProjectIconNode = Node.create<ProjectIconNodeOptions>({
  name: 'projectIcon', group: 'inline', inline: true, atom: true, selectable: true, marks: '_',
  addOptions() { return {} },
  addAttributes() {
    return {
      seriesKey: { default: '', parseHTML: element => element.getAttribute('data-oc-icon-series') ?? '' },
      iconKey: { default: '', parseHTML: element => element.getAttribute('data-oc-icon-key') ?? '' },
    }
  },
  parseHTML() {
    return [{
      tag: 'span[data-oc-icon-series][data-oc-icon-key]',
      getAttrs: element => {
        if (!(element instanceof HTMLElement)) return false
        const seriesKey = element.getAttribute('data-oc-icon-series') ?? ''
        const iconKey = element.getAttribute('data-oc-icon-key') ?? ''
        return keyPattern.test(seriesKey) && keyPattern.test(iconKey) ? { seriesKey, iconKey } : false
      },
    }]
  },
  renderHTML({ node, HTMLAttributes }) {
    const seriesKey = String(node.attrs.seriesKey ?? '')
    const iconKey = String(node.attrs.iconKey ?? '')
    const { seriesKey: _seriesKey, iconKey: _iconKey, ...safeAttributes } = HTMLAttributes
    return ['span', mergeAttributes(safeAttributes, {
      'data-oc-icon-series': seriesKey,
      'data-oc-icon-key': iconKey,
    }), `[[icon:${seriesKey}/${iconKey}]]`]
  },
  renderText({ node }) { return `[[icon:${node.attrs.seriesKey}/${node.attrs.iconKey}]]` },
  addNodeView() { return VueNodeViewRenderer(ProjectIconNodeView) },
  addInputRules() {
    return [nodeInputRule({
      find: /\[\[icon:([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)\]\]$/,
      type: this.type,
      getAttributes: match => ({ seriesKey: match[1], iconKey: match[2] }),
    })]
  },
  addPasteRules() {
    return [nodePasteRule({
      find: /\[\[icon:([a-z0-9][a-z0-9._-]*)\/([a-z0-9][a-z0-9._-]*)\]\]/g,
      type: this.type,
      getAttributes: match => ({ seriesKey: match[1], iconKey: match[2] }),
    })]
  },
})
