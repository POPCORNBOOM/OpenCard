import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const series: ProjectIconSeries = {
  name: 'Status icons',
  key: 'status',
  source: 'assets/icons/status.png',
  grid: { snapToGrid: false, rows: 2, columns: 3, pixelated: false },
  icons: [
    { iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 },
    { iconKey: 'success', name: 'Success', x: 16, y: 0, width: 16, height: 16 },
  ],
}
const runtime = {
  name: 'Status icons', key: 'status', source: series.source, src: 'asset://status', imageWidth: 64, imageHeight: 32,
}

describe('ProjectIconSetWorkspace', () => {
  it('shows a dashed crop placeholder instead of empty inspector panes', () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series: { ...series, icons: [] }, runtime, selectedIconIndexes: [] },
    })
    expect(wrapper.get('.project-icon-set-workspace').classes()).toContain('is-empty')
    expect(wrapper.get('.project-icon-set-workspace__empty').text()).toContain('projectConfig.icons.noCropRecords')
    expect(wrapper.find('.project-icon-set-workspace__tree-pane').exists()).toBe(false)
    expect(wrapper.find('.project-icon-set-workspace__property-pane').exists()).toBe(false)
  })

  it('keeps the icon tree and property editor side by side inside an expanded set', () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndexes: [0] },
    })
    expect(wrapper.find('.project-icon-set-workspace__tree-pane').exists()).toBe(true)
    expect(wrapper.find('.project-icon-set-workspace__property-pane').exists()).toBe(true)
    expect(wrapper.getComponent(OcTree).props('virtualized')).toBe(true)
    expect(wrapper.getComponent(OcTree).props('data').items.get('icon:0')?.actions).toEqual([
      'duplicate', 'move-top', 'move-up', 'move-down', 'move-bottom', 'delete',
    ])
    expect(wrapper.getComponent(OcTree).props('actions')?.get('move-top')?.icon).toBe('format.vertical-top')
    expect(wrapper.getComponent(OcTree).props('actions')?.get('move-bottom')?.icon).toBe('format.vertical-bottom')
    expect([...wrapper.getComponent(OcTree).props('data').items.get('icon:0')!.disabledActions!.keys()])
      .toEqual(['move-top', 'move-up'])
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Warning')
  })

  it('filters by icon name or key while preserving original icon indexes', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndexes: [0] },
    })
    const input = wrapper.get('input[placeholder="projectConfig.icons.filterPlaceholder"]')

    await input.setValue('success')
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual(['icon:1'])

    await input.setValue('warning')
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'icon:0', selectedKeys: ['icon:0'], mode: 'replace',
    })
    expect(wrapper.emitted('update:selectedIconIndexes')).toEqual([[[0]]])
  })

  it('keeps a 992-icon set windowed in the DOM', () => {
    const largeSeries: ProjectIconSeries = {
      ...series,
      icons: Array.from({ length: 992 }, (_, index) => ({
        iconKey: `icon-${index}`,
        name: `Icon ${index}`,
        x: 0,
        y: 0,
        width: 16,
        height: 16,
      })),
    }
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series: largeSeries, runtime, selectedIconIndexes: [0] },
    })

    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toHaveLength(992)
    expect(wrapper.findAll('[data-oc-tree-key]').length).toBeLessThanOrEqual(12)
  })

  it('emits controlled selection and immutable series updates', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndexes: [0] },
    })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'icon:1', selectedKeys: ['icon:1'], mode: 'replace',
    })
    expect(wrapper.emitted('update:selectedIconIndexes')).toEqual([[[1]]])

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'name', value: 'Alert',
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    expect(updated.icons[0]?.name).toBe('Alert')
    expect(series.icons[0]?.name).toBe('Warning')
  })

  it('uses the first selected icon for inspection and all selected icons for context moves and deletes', async () => {
    const multiSeries: ProjectIconSeries = {
      ...series,
      icons: [
        ...series.icons,
        { iconKey: 'info', name: 'Info', x: 32, y: 0, width: 16, height: 16 },
      ],
    }
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series: multiSeries, runtime, selectedIconIndexes: [0, 2] },
    })

    expect(wrapper.getComponent(OcTree).props('selectedKeys')).toEqual(['icon:0', 'icon:2'])
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Warning')

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'icon:2', actionKey: 'move-bottom', source: 'context',
    })
    let updates = wrapper.emitted('update:series') ?? []
    let updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    expect(updated.icons.map(icon => icon.iconKey)).toEqual(['success', 'warning', 'info'])
    expect(wrapper.emitted('update:selectedIconIndexes')).toContainEqual([[1, 2]])

    await wrapper.setProps({ series: updated, selectedIconIndexes: [1, 2] })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'icon:2', actionKey: 'delete', source: 'context',
    })
    updates = wrapper.emitted('update:series') ?? []
    updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    expect(updated.icons.map(icon => icon.iconKey)).toEqual(['success'])
    expect(wrapper.emitted('update:selectedIconIndexes')).toContainEqual([[0]])
  })

  it('moves an icon directly to the top or bottom', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndexes: [0] },
    })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'icon:0', actionKey: 'move-bottom', source: 'inline',
    })
    let updates = wrapper.emitted('update:series') ?? []
    expect((updates[updates.length - 1]?.[0] as ProjectIconSeries).icons.map(icon => icon.iconKey))
      .toEqual(['success', 'warning'])

    await wrapper.setProps({ selectedIconIndexes: [1] })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'icon:1', actionKey: 'move-top', source: 'inline',
    })
    updates = wrapper.emitted('update:series') ?? []
    expect((updates[updates.length - 1]?.[0] as ProjectIconSeries).icons.map(icon => icon.iconKey))
      .toEqual(['success', 'warning'])
  })

  it('duplicates an icon after its source and selects the copy', () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndexes: [0] },
    })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'icon:0', actionKey: 'duplicate', source: 'inline',
    })

    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    expect(updated.icons[1]).toEqual({ ...series.icons[0], iconKey: 'warning-2' })
    expect(wrapper.emitted('update:selectedIconIndexes')).toEqual([[[1]]])
  })

  it('selects the next neighboring icon after deleting a middle icon', async () => {
    const icons = [
      series.icons[0]!,
      series.icons[1]!,
      { iconKey: 'info', name: 'Info', x: 32, y: 0, width: 16, height: 16 },
    ]
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series: { ...series, icons }, runtime, selectedIconIndexes: [1] },
    })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'icon:1', actionKey: 'delete', source: 'inline',
    })
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    await wrapper.setProps({ series: updated, selectedIconIndexes: [1] })

    expect(wrapper.emitted('update:selectedIconIndexes')).toEqual([[[1]]])
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Info')
  })

})
