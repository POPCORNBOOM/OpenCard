import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import ProjectIconView from '../../features/workspace/components/ProjectIconView.vue'
import OcButton from '../base/OcButton.vue'
import OcIcon from '../base/OcIcon.vue'
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
        name: candidate.name,
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
    name: 'Status icons', key: 'status', source: 'assets/icons/status.png',
    icons: [{ iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 }],
  },
  { name: 'Action icons', key: 'actions', source: 'assets/icons/actions.png', icons: [] },
]
const projectIconCatalog = {
  series: [{ name: 'Status icons', key: 'status', source: series[0]!.source, src: 'asset://ready', imageWidth: 64, imageHeight: 32 }],
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
    expect(wrapper.findAllComponents(OcIcon).some(icon => icon.props('name') === 'file.package-variant')).toBe(true)
    expect(wrapper.get('.project-config-section__heading').text()).toContain('Status icons')
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props()).toMatchObject({
      series: series[0],
      selectedIconIndexes: [0],
    })
    expect(wrapper.getComponent(ProjectIconCropEditor).props('runtime')).toMatchObject({
      key: 'status',
      imageWidth: 64,
      imageHeight: 32,
    })
    expect(wrapper.find('.project-icon-crop-editor__viewport-toolbar').exists()).toBe(true)
    const focusButton = wrapper.findAllComponents(OcButton)
      .find(button => button.props('icon') === 'tool.focus-selection')
    expect(focusButton?.attributes('aria-label')).toBe('projectConfig.icons.autoFocusSelected')
    expect(focusButton?.props('disabled')).toBe(false)
    expect(focusButton?.attributes('aria-pressed')).toBe('true')
    expect(wrapper.getComponent(ProjectIconView).props('mode')).toBe('preview')
  })

  it('keeps the original workbench owner in read-only comparison mode', async () => {
    const historicalSeries: ProjectIconSeries[] = [
      {
        ...series[0]!,
        icons: [{ ...series[0]!.icons[0]!, name: 'Historical warning' }],
      },
      { name: 'Legacy icons', key: 'legacy', source: 'assets/icons/legacy.png', icons: [] },
    ]
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: {
        ...baseProps,
        comparison: true,
        comparisonSeries: historicalSeries,
        comparisonResolveAssetSrc: (source: string) => `historical://${source}`,
        readOnly: true,
        projectIconCatalog,
      },
    })
    await wrapper.vm.$nextTick()
    await Promise.resolve()

    expect(wrapper.findAll('.project-config-section__heading')).toHaveLength(3)
    expect(wrapper.findAll('.project-icon-registry-workbench__change-markers')).toHaveLength(3)
    expect(wrapper.findAllComponents(ProjectIconCropEditor)).toHaveLength(2)
    expect(wrapper.findAllComponents(ProjectIconCropEditor)[0]?.props('runtime')).toMatchObject({
      src: 'historical://assets/icons/status.png',
    })
    expect(wrapper.findAllComponents(ProjectIconCropEditor)[1]?.props('runtime')).toMatchObject({
      src: 'asset://assets/icons/status.png',
    })
    const propertyInputs = wrapper.getComponent(ProjectIconSetWorkspace).props('series')
    expect(propertyInputs.key).toBe('status')
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('comparisonSeries')).toEqual(historicalSeries[0])
    expect(wrapper.find('button[aria-label="projectConfig.icons.createPack"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="projectConfig.icons.addSingleCrop"]').exists()).toBe(false)
    expect(wrapper.emitted('update:series')).toBeUndefined()
  })

  it('uses the shared current-order pairing for removed series', async () => {
    const historicalSeries: ProjectIconSeries[] = [
      { name: 'Removed first', key: 'removed-first', source: 'assets/icons/removed-first.png', icons: [] },
      series[0]!,
      { name: 'Removed middle', key: 'removed-middle', source: 'assets/icons/removed-middle.png', icons: [] },
      series[1]!,
    ]
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, comparison: true, comparisonSeries: historicalSeries, readOnly: true },
    })
    expect(wrapper.findAll('.project-config-section__title').map(node => node.text())).toEqual([
      'Removed first', 'Status icons', 'Removed middle', 'Action icons',
    ])
  })

  it('routes pack creation through the left title action', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await wrapper.get('button[aria-label="projectConfig.icons.createPack"]').trigger('click')
    expect(wrapper.emitted('create-pack')).toEqual([[]])
  })

  it('adds and selects one crop beside the even-grid action', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog },
    })
    await wrapper.vm.$nextTick()
    const addButton = wrapper.get('button[aria-label="projectConfig.icons.addSingleCrop"]')
    expect(wrapper.get('button[aria-label="projectConfig.icons.generateIcons"]')).toBeTruthy()
    await addButton.trigger('click')

    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(updated[0]?.icons[1]).toMatchObject({
      name: 'projectConfig.icons.defaultIconName', x: 0, y: 0, width: 32, height: 16,
    })
    await wrapper.setProps({ series: updated })
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('selectedIconIndexes')).toEqual([1])
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

  it('keeps the next neighboring set selected after deleting a middle set', async () => {
    const threeSeries = [
      series[0]!,
      series[1]!,
      { name: 'Social icons', key: 'social', source: 'assets/icons/social.png', icons: [] },
    ]
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, series: threeSeries },
    })
    await (wrapper.vm as unknown as { selectSeries(key: string): Promise<boolean> }).selectSeries('actions')
    await wrapper.findAll('button[aria-label="projectConfig.icons.removeSeries"]')[1]!.trigger('click')
    const updates = wrapper.emitted('update:series') ?? []
    const remaining = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    await wrapper.setProps({ series: remaining })

    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('series')).toEqual(threeSeries[2])
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
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('selectedIconIndexes')).toEqual([0])
  })
})
