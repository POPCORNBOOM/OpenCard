import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import type { OcNodeAction } from '../../shared/ui/node/node.types'
import { isNodeTailAction, normalizeNodeTail } from '../../shared/ui/node/node.types'
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
    const nodeActions = (key: string): readonly OcNodeAction[] => {
      const actions = normalizeNodeTail(wrapper.getComponent(OcTree).props('data').items.get(key)?.tail)
        .filter(isNodeTailAction)
      expect(actions).toBeDefined()
      return actions ?? []
    }
    const disabledActionEntries = (key: string): unknown[] => nodeActions(key)
      .filter(action => action.disabled)
      .map(action => [action.key, action.disabledReason])

    expect(wrapper.find('.project-icon-set-workspace__tree-pane').exists()).toBe(true)
    expect(wrapper.find('.project-icon-set-workspace__property-pane').exists()).toBe(true)
    expect(wrapper.getComponent(OcTree).props('virtualized')).toBe(true)
    expect(nodeActions('icon:0').map(action => action.key)).toEqual([
      'duplicate', 'move-top', 'move-up', 'move-down', 'move-bottom', 'delete',
    ])
    expect(nodeActions('icon:0').find(action => action.key === 'move-top')?.icon).toBe('format.vertical-top')
    expect(nodeActions('icon:0').find(action => action.key === 'move-bottom')?.icon).toBe('format.vertical-bottom')
    expect(disabledActionEntries('icon:0')).toEqual([
      ['move-top', 'projectConfig.icons.alreadyAtTop'],
      ['move-up', 'projectConfig.icons.alreadyAtTop'],
    ])
    expect(disabledActionEntries('icon:1')).toEqual([
      ['move-down', 'projectConfig.icons.alreadyAtBottom'],
      ['move-bottom', 'projectConfig.icons.alreadyAtBottom'],
    ])
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
    wrapper.getComponent(OcTree).vm.$emit('selection-change', {
      triggerKey: 'icon:0', selectedKeys: ['icon:0'],
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
    wrapper.getComponent(OcTree).vm.$emit('selection-change', {
      triggerKey: 'icon:1', selectedKeys: ['icon:1'],
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

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'rotation', value: '90°',
    })
    await wrapper.vm.$nextTick()
    const rotatedUpdates = wrapper.emitted('update:series') ?? []
    const rotated = rotatedUpdates[rotatedUpdates.length - 1]?.[0] as ProjectIconSeries
    expect(rotated.icons[0]?.rotation).toBe(90)
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

    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:2', actionKey: 'move-bottom', source: 'context',
    })
    let updates = wrapper.emitted('update:series') ?? []
    let updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    expect(updated.icons.map(icon => icon.iconKey)).toEqual(['success', 'warning', 'info'])
    expect(wrapper.emitted('update:selectedIconIndexes')).toContainEqual([[1, 2]])

    await wrapper.setProps({ series: updated, selectedIconIndexes: [1, 2] })
    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:2', actionKey: 'delete', source: 'context',
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
    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:0', actionKey: 'move-bottom', source: 'inline',
    })
    let updates = wrapper.emitted('update:series') ?? []
    expect((updates[updates.length - 1]?.[0] as ProjectIconSeries).icons.map(icon => icon.iconKey))
      .toEqual(['success', 'warning'])

    await wrapper.setProps({ selectedIconIndexes: [1] })
    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:1', actionKey: 'move-top', source: 'inline',
    })
    updates = wrapper.emitted('update:series') ?? []
    expect((updates[updates.length - 1]?.[0] as ProjectIconSeries).icons.map(icon => icon.iconKey))
      .toEqual(['success', 'warning'])
  })

  it('duplicates an icon after its source and selects the copy', () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndexes: [0] },
    })
    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:0', actionKey: 'duplicate', source: 'inline',
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
    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:1', actionKey: 'delete', source: 'inline',
    })
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    await wrapper.setProps({ series: updated, selectedIconIndexes: [1] })

    expect(wrapper.emitted('update:selectedIconIndexes')).toEqual([[[1]]])
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Info')
  })

})
