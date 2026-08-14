import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectFontComposition, ProjectFontFamily } from '../../features/workspace/model/projectFontRegistry'
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

const face = (source: string) => ({
  source,
  weight: { min: 400, max: 400 },
  stretch: { min: 100, max: 100 },
  style: { kind: 'normal' as const },
})
const families: ProjectFontFamily[] = [
  { key: 'brand-latin', name: 'Latin', faces: [face('fonts/Brand.woff2')] },
  { key: 'brand-cjk', name: 'CJK', faces: [face('fonts/BrandCJK.woff2')] },
  { key: 'symbols', name: 'Symbols', faces: [face('fonts/Symbols.woff2')] },
]
const compositions: ProjectFontComposition[] = [
  { key: 'body', name: 'Body', members: [{ familyKey: 'brand-latin' }, { familyKey: 'brand-cjk' }] },
]
const baseProps = {
  heading: 'Project Fonts',
  description: 'Manage fonts and sets',
  families,
  compositions,
  resolveAssetSrc: (source: string) => `asset://${source}`,
  readFontBytes: async (source: string) => new Uint8Array([
    source.includes('BrandCJK') ? 2 : source.includes('Brand.woff2') ? 1 : 3,
  ]),
}

describe('ProjectFontRegistryEditor', () => {
  it('uses the standard tree for fonts and font sets', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual([
      'families', 'compositions',
    ])
    expect(wrapper.getComponent(OcTree).props('expandedKeys')).toEqual(['families', 'compositions'])
    expect(wrapper.getComponent(OcTree).props('data').children.get('families')).toEqual([
      'families:brand-latin', 'families:brand-cjk', 'families:symbols',
    ])
    expect(wrapper.getComponent(OcTree).text()).not.toContain('assets/fonts/Brand.woff2')
    expect(wrapper.getComponent(OcTree).text()).not.toContain('font:brand-latin')

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'compositions:body', selectedKeys: ['compositions:body'], mode: 'replace', input: 'left',
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual(['families', 'compositions'])
    expect(wrapper.getComponent(OcTree).props('data').children.get('compositions')).toEqual(['compositions:body'])
  })

  it('selects the next font after deleting a middle font and allows deleting the last one', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', { type: 'selection.change', selectedKeys: ['families:symbols'] })
    await wrapper.vm.$nextTick()
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'families:symbols', actionKey: 'delete-family' })
    expect(wrapper.emitted('remove-family')).toEqual([['symbols']])
    const updated = families.filter(family => family.key !== 'symbols')
    await wrapper.setProps({ families: updated })
    expect(wrapper.get('.project-font-registry-workbench__preview').text()).toContain('projectConfig.fonts.previewSample')
    expect(wrapper.getComponent(OcTree).props('selectedKeys')).toEqual(['families:brand-cjk'])

    await wrapper.setProps({ families: [families[0]!], compositions: [] })
    wrapper.getComponent(OcTree).vm.$emit('intent', { type: 'action.invoke', key: 'families:brand-latin', actionKey: 'delete-family' })
    const removals = wrapper.emitted('remove-family') ?? []
    expect(removals[removals.length - 1]).toEqual(['brand-latin'])
  })

  it('provides both add commands and routes double-click activation', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps })
    await wrapper.get('[aria-label="projectConfig.fonts.addFont"]').trigger('click')
    await wrapper.get('[aria-label="projectConfig.fonts.addSet"]').trigger('click')
    expect(wrapper.emitted('register-family')).toHaveLength(1)
    expect(wrapper.emitted('register-composition')).toHaveLength(1)
    wrapper.getComponent(OcTree).vm.$emit('intent', { type: 'node.activate', key: 'compositions:body' })
    expect(wrapper.emitted('configure-composition')).toEqual([['body']])
  })

  it('groups preview text by resolved font and shows registration details on hover', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: baseProps, attachTo: document.body })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'compositions', selectedKeys: ['compositions'], mode: 'replace', input: 'left',
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
    expect(info?.textContent).toContain('fonts/BrandCJK.woff2')
    wrapper.unmount()
  })
})
