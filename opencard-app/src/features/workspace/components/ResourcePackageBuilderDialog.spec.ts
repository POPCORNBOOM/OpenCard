import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import ResourcePackageBuilderDialog from './ResourcePackageBuilderDialog.vue'

const projectStore = vi.hoisted(() => ({
  projectFontFamilies: { value: [
    { key: 'latin', name: 'Latin', files: { normal: { upright: 'fonts/latin.ttf' } } },
    { key: 'cjk', name: 'CJK', files: { normal: { upright: 'fonts/cjk.ttf' } } },
  ] },
  projectFontCompositions: { value: [
    { key: 'body', name: 'Body', members: [{ fontKey: 'latin' }, { fontKey: 'cjk' }] },
  ] },
  projectIconSeries: { value: [] },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../store/projectStore', () => ({ useProjectStore: () => projectStore }))

describe('ResourcePackageBuilderDialog font selection', () => {
  it('shows font subtrees and cascades composition membership and removal', async () => {
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
    expect(data.items.get('font-family:latin')?.actions).toEqual(['deselect'])
    expect(data.items.get('font-family:cjk')?.actions).toEqual(['deselect'])

    tree.vm.$emit('intent', { type: 'action.invoke', key: 'font-family:cjk', actionKey: 'deselect' })
    await nextTick()
    data = tree.props('data') as OcTreeData
    expect(data.items.get('font-composition:body')?.actions).toEqual(['select'])
    expect(data.items.get('font-family:latin')?.actions).toEqual(['select'])
    expect(data.items.get('font-family:cjk')?.actions).toEqual(['select'])
  })
})
