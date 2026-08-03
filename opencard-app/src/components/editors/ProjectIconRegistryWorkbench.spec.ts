import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import OcCard from '../standard/OcCard.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectIconCropEditor from './ProjectIconCropEditor.vue'
import ProjectIconRegistryWorkbench from './ProjectIconRegistryWorkbench.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/services/projectIconCatalog')>()
  return {
    ...actual,
    buildProjectIconCatalog: vi.fn(async (series: readonly ProjectIconSeries[], resolve: (source: string) => string) => ({
      series: series.map(candidate => ({
        key: candidate.key,
        source: candidate.source,
        src: resolve(candidate.source),
        imageWidth: 64,
        imageHeight: 32,
      })),
      entries: [],
      errors: [],
    })),
  }
})

const series: ProjectIconSeries[] = [
  {
    key: 'status', source: 'assets/icons/status.png',
    icons: [{ iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 }],
  },
  { key: 'actions', source: 'assets/icons/actions.png', icons: [] },
]
const projectIconCatalog = {
  series: [{ key: 'status', source: series[0]!.source, src: 'asset://ready', imageWidth: 64, imageHeight: 32 }],
  entries: [],
  errors: [],
}

describe('ProjectIconRegistryWorkbench', () => {
  it('starts unselected and opens the selected icon set from the series tree', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { series, projectIconCatalog, resolveAssetSrc: source => `asset://${source}` },
    })
    expect(wrapper.find('.project-icon-registry-workbench__placeholder').exists()).toBe(true)
    expect(wrapper.findComponent(ProjectIconSetWorkspace).exists()).toBe(false)

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'series:0', selectedKeys: ['series:0'], mode: 'replace',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.project-icon-registry-workbench__placeholder').exists()).toBe(false)
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props()).toMatchObject({
      series: series[0],
      selectedIconIndex: 0,
    })
    expect(wrapper.getComponent(ProjectIconCropEditor).props('runtime')).toMatchObject({
      key: 'status',
      imageWidth: 64,
      imageHeight: 32,
    })
    expect(wrapper.find('.project-icon-crop-editor__viewport-toolbar').exists()).toBe(true)
  })

  it('routes registration through the icon-set card action', () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    const seriesCard = wrapper.getComponent(OcCard)
    expect(seriesCard.props('actions')).toMatchObject([{ key: 'register' }])
    seriesCard.vm.$emit('action', { key: 'register' })
    expect(wrapper.emitted('register')).toEqual([[]])
  })

  it('replaces only the selected series and returns to the placeholder after deletion', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    await (wrapper.vm as unknown as { selectSeries(key: string): Promise<boolean> }).selectSeries('status')
    const updatedStatus = { ...series[0]!, icons: [{ ...series[0]!.icons[0]!, name: 'Alert' }] }
    wrapper.getComponent(ProjectIconSetWorkspace).vm.$emit('update:series', updatedStatus)
    await wrapper.vm.$nextTick()
    let updates = wrapper.emitted('update:series') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual([updatedStatus, series[1]])

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'series:0', actionKey: 'delete',
    })
    await wrapper.vm.$nextTick()
    updates = wrapper.emitted('update:series') ?? []
    const remaining = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(remaining).toEqual([series[1]])
    await wrapper.setProps({ series: remaining })
    expect(wrapper.find('.project-icon-registry-workbench__placeholder').exists()).toBe(true)
  })

  it('selects the target set and icon for issue navigation', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    const result = await (wrapper.vm as unknown as {
      navigateToKeyConflict(conflict: { kind: 'icon'; seriesIndex: number; iconIndex: number; key: string }): Promise<boolean>
    }).navigateToKeyConflict({ kind: 'icon', seriesIndex: 0, iconIndex: 0, key: 'warning' })
    await wrapper.vm.$nextTick()

    expect(result).toBe(true)
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('selectedIconIndex')).toBe(0)
  })
})
