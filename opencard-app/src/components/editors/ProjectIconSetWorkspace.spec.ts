import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcCard from '../standard/OcCard.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectIconCropEditor from './ProjectIconCropEditor.vue'
import ProjectIconGridDialog from './ProjectIconGridDialog.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const series: ProjectIconSeries = {
  key: 'status',
  source: 'assets/icons/status.png',
  grid: { snapToGrid: false, rows: 2, columns: 3, pixelated: false },
  icons: [
    { iconKey: 'warning', name: 'Warning', x: 0, y: 0, width: 16, height: 16 },
    { iconKey: 'success', name: 'Success', x: 16, y: 0, width: 16, height: 16 },
  ],
}
const runtime = {
  key: 'status', source: series.source, src: 'asset://status', imageWidth: 64, imageHeight: 32,
}

describe('ProjectIconSetWorkspace', () => {
  it('keeps the canvas, icon list and property editor in one selected-set workspace', () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndex: 0 },
    })
    expect(wrapper.find('.project-icon-set-workspace__canvas-pane').exists()).toBe(true)
    expect(wrapper.find('.project-icon-set-workspace__icon-list').exists()).toBe(true)
    expect(wrapper.find('.project-icon-set-workspace__properties').exists()).toBe(true)
    expect(wrapper.getComponent(ProjectIconCropEditor).props('fill')).toBe(true)
    expect(wrapper.findAllComponents(OcCard).map(card => card.props('title'))).toEqual([
      'projectConfig.icons.iconList',
      'projectConfig.icons.properties',
    ])
    expect(wrapper.findAllComponents(OcOverlayToolbar)).toHaveLength(3)
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Warning')
  })

  it('opens grid generation through the icon-list card action', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndex: 0 },
    })
    wrapper.findAllComponents(OcCard)[0]!.vm.$emit('action', { key: 'generate' })
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(ProjectIconGridDialog).props('open')).toBe(true)
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

  it('keeps grid snapping and pixel preview updates on the selected series', async () => {
    const wrapper = mount(ProjectIconSetWorkspace, {
      props: { series, runtime, selectedIconIndex: 0 },
    })
    await wrapper.get('button[aria-label="projectConfig.icons.snapToGrid"]').trigger('click')
    let updates = wrapper.emitted('update:series') ?? []
    expect((updates[updates.length - 1]?.[0] as ProjectIconSeries).grid?.snapToGrid).toBe(true)

    wrapper.getComponent(ProjectIconCropEditor).vm.$emit('update:pixelated', true)
    await wrapper.vm.$nextTick()
    updates = wrapper.emitted('update:series') ?? []
    expect((updates[updates.length - 1]?.[0] as ProjectIconSeries).grid?.pixelated).toBe(true)
  })
})
