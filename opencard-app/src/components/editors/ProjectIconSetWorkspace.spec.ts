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
      props: { series: { ...series, icons: [] }, runtime, selectedIconIndex: null },
    })
    expect(wrapper.get('.project-icon-set-workspace').classes()).toContain('is-empty')
    expect(wrapper.get('.project-icon-set-workspace__empty').text()).toContain('projectConfig.icons.noCropRecords')
    expect(wrapper.find('.project-icon-set-workspace__tree-pane').exists()).toBe(false)
    expect(wrapper.find('.project-icon-set-workspace__property-pane').exists()).toBe(false)
  })

  it('keeps the icon tree and property editor side by side inside an expanded set', () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndex: 0 },
    })
    expect(wrapper.find('.project-icon-set-workspace__tree-pane').exists()).toBe(true)
    expect(wrapper.find('.project-icon-set-workspace__property-pane').exists()).toBe(true)
    expect(wrapper.getComponent(OcTree).props('virtualized')).toBe(true)
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Warning')
  })

  it('filters by icon name or key while preserving original icon indexes', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndex: 0 },
    })
    const input = wrapper.get('input[placeholder="projectConfig.icons.filterPlaceholder"]')

    await input.setValue('success')
    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toEqual(['icon:1'])

    await input.setValue('warning')
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'icon:0', selectedKeys: ['icon:0'], mode: 'replace',
    })
    expect(wrapper.emitted('update:selectedIconIndex')).toEqual([[0]])
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
      props: { series: largeSeries, runtime, selectedIconIndex: 0 },
    })

    expect(wrapper.getComponent(OcTree).props('data').rootKeys).toHaveLength(992)
    expect(wrapper.findAll('[data-oc-tree-key]').length).toBeLessThanOrEqual(12)
  })

  it('emits controlled selection and immutable series updates', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndex: 0 },
    })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'icon:1', selectedKeys: ['icon:1'], mode: 'replace',
    })
    expect(wrapper.emitted('update:selectedIconIndex')).toEqual([[1]])

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'name', value: 'Alert',
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries
    expect(updated.icons[0]?.name).toBe('Alert')
    expect(series.icons[0]?.name).toBe('Warning')
  })

})
