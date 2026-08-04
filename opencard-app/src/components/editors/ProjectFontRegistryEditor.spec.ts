import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectFont, ProjectFontSet } from '../../features/workspace/model/projectFontRegistry'
import OcTree from '../standard/OcTree.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const fonts: ProjectFont[] = [
  { key: 'brand-latin', name: 'Latin', source: 'assets/fonts/Brand.woff2' },
  { key: 'brand-cjk', name: 'CJK', source: 'assets/fonts/BrandCJK.woff2' },
  { key: 'symbols', name: 'Symbols', source: 'assets/fonts/Symbols.woff2' },
]
const fontSets: ProjectFontSet[] = [
  { key: 'body', name: 'Body', fontKeys: ['brand-latin', 'brand-cjk', 'brand-latin'] },
]
const baseProps = {
  heading: 'Project Fonts',
  description: 'Manage fonts and sets',
  fonts,
  fontSets,
  resolveAssetSrc: (source: string) => `asset://${source}`,
}

describe('ProjectFontRegistryEditor', () => {
  it('uses the standard tree for fonts and font sets', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual([
      'fonts:brand-latin', 'fonts:brand-cjk', 'fonts:symbols',
    ])
    expect(wrapper.getComponent(OcTree).text()).not.toContain('assets/fonts/Brand.woff2')
    expect(wrapper.getComponent(OcTree).text()).not.toContain('font:brand-latin')

    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual(['sets:body'])
    expect(wrapper.get('.project-font-registry-workbench__preview').attributes('style'))
      .toContain('OpenCardProjectFont-brand-latin')
  })

  it('selects the next font after deleting a middle font and allows deleting the last one', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', { type: 'selection.change', selectedKeys: ['fonts:brand-cjk'] })
    await wrapper.vm.$nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'fonts:brand-cjk', actionKey: 'delete' })
    const updates = wrapper.emitted('update:fonts') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectFont[]
    await wrapper.setProps({ fonts: updated })
    expect(wrapper.get('.project-font-registry-workbench__preview').text()).toContain('projectConfig.fonts.previewSample')
    expect(wrapper.getComponent(OcTree).props('selectedKeys')).toEqual(['fonts:symbols'])

    await wrapper.setProps({ fonts: [fonts[0]!] })
    wrapper.getComponent(OcTree).vm.$emit('intent', { type: 'action.invoke', key: 'fonts:brand-latin', actionKey: 'delete' })
    const finalUpdates = wrapper.emitted('update:fonts') ?? []
    expect(finalUpdates[finalUpdates.length - 1]?.[0]).toEqual([])
  })

  it('routes contextual add and double-click activation', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    await wrapper.get('[aria-label="projectConfig.fonts.addSet"]').trigger('click')
    expect(wrapper.emitted('register-font-set')).toHaveLength(1)
    wrapper.getComponent(OcTree).vm.$emit('intent', { type: 'node.activate', key: 'sets:body' })
    expect(wrapper.emitted('configure-font-set')).toEqual([['body']])
  })
})
