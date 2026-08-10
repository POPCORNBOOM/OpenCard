import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectFont, ProjectFontSet } from '../../features/workspace/model/projectFontRegistry'
import OcTree from '../standard/OcTree.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/projectFontCoverage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/services/projectFontCoverage')>()
  return {
    ...actual,
    readProjectFontCharacterSet: vi.fn(async (bytes: Uint8Array) => new Set(
      bytes[0] === 1
        ? [32, 65, 66, 67]
        : bytes[0] === 2
          ? [0x4e2d, 0x6587]
          : [],
    )),
  }
})

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
  readFontBytes: async (source: string) => new Uint8Array([
    source.includes('BrandCJK') ? 2 : source.includes('Brand.woff2') ? 1 : 3,
  ]),
}

describe('ProjectFontRegistryEditor', () => {
  it('uses the standard tree for fonts and font sets', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual([
      'fonts', 'sets',
    ])
    expect(wrapper.getComponent(OcTree).props('expandedKeys')).toEqual(['fonts', 'sets'])
    expect(wrapper.getComponent(OcTree).props('data').children.get('fonts')).toEqual([
      'fonts:brand-latin', 'fonts:brand-cjk', 'fonts:symbols',
    ])
    expect(wrapper.getComponent(OcTree).text()).not.toContain('assets/fonts/Brand.woff2')
    expect(wrapper.getComponent(OcTree).text()).not.toContain('font:brand-latin')

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'sets:body', selectedKeys: ['sets:body'], mode: 'replace', input: 'left',
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual(['fonts', 'sets'])
    expect(wrapper.getComponent(OcTree).props('data').children.get('sets')).toEqual(['sets:body'])
    expect(wrapper.get('.project-font-registry-workbench__preview').attributes('style'))
      .toContain('OpenCardProjectFont-brand-latin')
  })

  it('selects the next font after deleting a middle font and allows deleting the last one', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', { type: 'selection.change', selectedKeys: ['fonts:brand-cjk'] })
    await wrapper.vm.$nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'fonts:brand-cjk', actionKey: 'delete-font' })
    const updates = wrapper.emitted('update:fonts') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectFont[]
    await wrapper.setProps({ fonts: updated })
    expect(wrapper.get('.project-font-registry-workbench__preview').text()).toContain('projectConfig.fonts.previewSample')
    expect(wrapper.getComponent(OcTree).props('selectedKeys')).toEqual(['fonts:symbols'])

    await wrapper.setProps({ fonts: [fonts[0]!] })
    wrapper.getComponent(OcTree).vm.$emit('intent', { type: 'action.invoke', key: 'fonts:brand-latin', actionKey: 'delete-font' })
    const finalUpdates = wrapper.emitted('update:fonts') ?? []
    expect(finalUpdates[finalUpdates.length - 1]?.[0]).toEqual([])
  })

  it('provides both add commands and routes double-click activation', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    await wrapper.get('[aria-label="projectConfig.fonts.addFont"]').trigger('click')
    await wrapper.get('[aria-label="projectConfig.fonts.addSet"]').trigger('click')
    expect(wrapper.emitted('register-font')).toHaveLength(1)
    expect(wrapper.emitted('register-font-set')).toHaveLength(1)
    wrapper.getComponent(OcTree).vm.$emit('intent', { type: 'node.activate', key: 'sets:body' })
    expect(wrapper.emitted('configure-font-set')).toEqual([['body']])
  })

  it('groups preview text by resolved font and shows registration details on hover', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps, attachTo: document.body })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'sets', selectedKeys: ['sets'], mode: 'replace', input: 'left',
    })
    const input = wrapper.get<HTMLInputElement>('.project-font-registry-workbench__preview-toolbar input')
    await input.setValue('AB中文🙂 C')

    await vi.waitFor(() => {
      expect(wrapper.findAll('.project-font-registry-workbench__preview-run').map(run => ({
        fontKey: run.attributes('data-font-key'),
        text: run.element.textContent,
      }))).toEqual([
        { fontKey: 'brand-latin', text: 'AB' },
        { fontKey: 'brand-cjk', text: '中文' },
        { fontKey: 'fallback', text: '🙂' },
        { fontKey: 'brand-latin', text: ' C' },
      ])
    })

    await wrapper.get('[data-font-key="brand-cjk"]').trigger('pointerenter')
    await wrapper.vm.$nextTick()
    const info = document.body.querySelector('.project-font-registry-workbench__font-info')
    expect(info?.textContent).toContain('CJK')
    expect(info?.textContent).toContain('brand-cjk')
    expect(info?.textContent).toContain('assets/fonts/BrandCJK.woff2')
    wrapper.unmount()
  })
})
