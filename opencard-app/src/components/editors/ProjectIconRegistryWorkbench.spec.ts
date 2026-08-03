import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import ProjectIconView from '../../features/workspace/components/ProjectIconView.vue'
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
const baseProps = {
  heading: 'Icon registry',
  description: 'Manage project icons',
  series,
  resolveAssetSrc: (source: string) => `asset://${source}`,
}

describe('ProjectIconRegistryWorkbench', () => {
  it('opens the first expander with a left inspector and split right preview', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.project-icon-registry-workbench__placeholder').exists()).toBe(false)
    expect(wrapper.get('.project-icon-registry-workbench__left h1').text()).toBe('Icon registry')
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
    expect(wrapper.getComponent(ProjectIconView).props('mode')).toBe('preview')
  })

  it('routes registration through the left title action', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await wrapper.get('button[aria-label="projectConfig.icons.register"]').trigger('click')
    expect(wrapper.emitted('register')).toEqual([[]])
  })

  it('replaces only the expanded series and selects the remaining set after deletion', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await (wrapper.vm as unknown as { selectSeries(key: string): Promise<boolean> }).selectSeries('status')
    const updatedStatus = { ...series[0]!, icons: [{ ...series[0]!.icons[0]!, name: 'Alert' }] }
    wrapper.getComponent(ProjectIconSetWorkspace).vm.$emit('update:series', updatedStatus)
    await wrapper.vm.$nextTick()
    let updates = wrapper.emitted('update:series') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual([updatedStatus, series[1]])

    await wrapper.findAll('button[aria-label="projectConfig.icons.removeSeries"]')[0]!.trigger('click')
    await wrapper.vm.$nextTick()
    updates = wrapper.emitted('update:series') ?? []
    const remaining = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(remaining).toEqual([series[1]])
    await wrapper.setProps({ series: remaining })
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('series')).toEqual(series[1])
  })

  it('selects the target set and icon for issue navigation', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    const result = await (wrapper.vm as unknown as {
      navigateToKeyConflict(conflict: { kind: 'icon'; seriesIndex: number; iconIndex: number; key: string }): Promise<boolean>
    }).navigateToKeyConflict({ kind: 'icon', seriesIndex: 0, iconIndex: 0, key: 'warning' })
    await wrapper.vm.$nextTick()

    expect(result).toBe(true)
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('selectedIconIndex')).toBe(0)
  })
})
