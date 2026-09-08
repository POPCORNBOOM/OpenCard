import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import ResourcePackageBuilderDialog from './ResourcePackageBuilderDialog.vue'

const buildPackage = vi.hoisted(() => vi.fn(async () => ({ outputPath: '/output/theme.ocpack' })))
const pickSavePath = vi.hoisted(() => vi.fn(async () => '/output/theme.ocpack'))

const projectStore = vi.hoisted(() => ({
  projectFontFamilies: { value: [
    { key: 'latin', name: 'Latin', files: { normal: { upright: 'fonts/latin.ttf' } } },
    { key: 'cjk', name: 'CJK', files: { normal: { upright: 'fonts/cjk.ttf' } } },
  ] },
  projectFontCompositions: { value: [
    { key: 'body', name: 'Body', members: [{ fontKey: 'latin' }, { fontKey: 'cjk' }] },
  ] },
  projectIconSeries: { value: [
    { key: 'status', name: 'Status', source: 'icons/status.png', icons: [] },
  ] },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../store/projectStore', () => ({ useProjectStore: () => projectStore }))
vi.mock('../services/buildResourcePackage', () => ({ buildResourcePackageFromProject: buildPackage }))
vi.mock('../services/fileSystemService', () => ({ fileSystemService: { pickSavePath } }))

describe('ResourcePackageBuilderDialog font selection', () => {
  it('keeps public font and composition selections independent', async () => {
    const wrapper = mount(ResourcePackageBuilderDialog, {
      props: { open: true, projectRootPath: '/project', projectName: 'Project', entries: [] },
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.findComponent(OcTree)
    let data = tree.props('data') as OcTreeData
    expect(data.children.get('category:fonts')).toEqual(['font-group:families', 'font-group:compositions'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-composition:body', actionKey: 'select' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('font-composition:body')?.actions).toEqual(['deselect'])
    expect(data.items.get('font-family:latin')?.actions).toEqual(['select'])
    expect(data.items.get('font-family:cjk')?.actions).toEqual(['select'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-family:cjk', actionKey: 'select' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('font-composition:body')?.actions).toEqual(['deselect'])
    expect(data.items.get('font-family:cjk')?.actions).toEqual(['deselect'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-family:cjk', actionKey: 'deselect' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('font-composition:body')?.actions).toEqual(['deselect'])
    expect(data.items.get('font-family:cjk')?.actions).toEqual(['select'])
  })

  it('selects project icon series without exposing spritesheet files', async () => {
    const wrapper = mount(ResourcePackageBuilderDialog, {
      props: { open: true, projectRootPath: '/project', projectName: 'Project', entries: [] },
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.findComponent(OcTree)
    let data = tree.props('data') as OcTreeData
    expect(data.children.get('category:icons')).toEqual(['icon-series:status'])
    expect([...data.items.keys()].some(key => key.includes('status.png'))).toBe(false)

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'icon-series:status', actionKey: 'select' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('icon-series:status')?.actions).toEqual(['deselect'])
    expect(data.items.get('category:icons')?.tail).toBe('1/1')

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'icon-series:status', actionKey: 'deselect' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('icon-series:status')?.actions).toEqual(['select'])
    expect(data.items.get('category:icons')?.tail).toBe('0/1')
  })

  it('shows only ordinary project images by directory and sends selected paths to the image selection', async () => {
    buildPackage.mockClear()
    const wrapper = mount(ResourcePackageBuilderDialog, {
      props: {
        open: false,
        projectRootPath: '/project',
        projectName: 'Project',
        entries: [
          'images/card.png', 'images/nested/banner.svg', 'images/notes.txt',
          '.opencard/icons/status.png', '.git/logo.png', '/outside/leak.png',
        ],
      },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.setProps({ open: true })
    const tree = wrapper.findComponent(OcTree)
    let data = tree.props('data') as OcTreeData

    expect(data.children.get('category:images')).toEqual(['folder:images:images'])
    expect(data.children.get('folder:images:images')).toEqual([
      'image:images/card.png', 'folder:images:images/nested',
    ])
    expect(data.items.has('image:images/nested/banner.svg')).toBe(true)
    expect([...data.items.keys()].some(key => key.includes('notes.txt') || key.includes('.opencard')
      || key.includes('.git') || key.includes('outside'))).toBe(false)

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'select' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('category:images')?.tail).toBe('1/2')
    expect(data.items.get('image:images/card.png')?.actions).toEqual(['deselect'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'deselect' })
    await nextTick()
    expect((tree.props('data') as OcTreeData).items.get('category:images')?.tail).toBe('0/2')

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'select' })
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/nested/banner.svg', actionKey: 'select' })
    await nextTick()
    expect(wrapper.get('.resource-package-builder__resource-count code').text()).toBe('2')
    await wrapper.get('[aria-label="resourcePackage.clearSelection"]').trigger('click')
    expect((tree.props('data') as OcTreeData).items.get('category:images')?.tail).toBe('0/2')

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'image:images/card.png', actionKey: 'select' })
    await nextTick()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(buildPackage).toHaveBeenCalledWith(expect.objectContaining({
      imageSelection: { paths: ['images/card.png'] },
    }))
  })
})
