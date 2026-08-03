import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcTree from '../standard/OcTree.vue'
import ProjectConfigSection from './ProjectConfigSection.vue'
import OcOverlayToolbar from '../standard/OcOverlayToolbar.vue'
import ProjectIconCropEditor from './ProjectIconCropEditor.vue'
import ProjectIconSeriesEditor from './ProjectIconSeriesEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

const series: ProjectIconSeries[] = [
  {
    key: 'status',
    source: 'assets/icons/status.png',
    icons: [
      { iconKey: 'one', name: 'Same name', x: 0, y: 0, width: 8, height: 8 },
      { iconKey: 'two', name: 'Second', x: 8, y: 0, width: 8, height: 8 },
    ],
  },
  { key: 'actions', source: 'assets/icons/actions.png', icons: [] },
]

describe('ProjectIconSeriesEditor', () => {
  it('keeps at most one spritesheet expanded and uses a flat repositionable tree', async () => {
    const wrapper = mount(ProjectIconSeriesEditor, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    const expanders = wrapper.findAllComponents(ProjectConfigSection)
    expect(expanders[0]?.props()).toMatchObject({
      collapsed: false,
      sectionIndent: 'single',
      contentIndent: 'single',
    })
    expect(expanders[0]?.props('description')).toBeUndefined()
    expect(expanders[1]?.props()).toMatchObject({
      collapsed: true,
      sectionIndent: 'single',
      contentIndent: 'single',
    })

    expanders[1]!.vm.$emit('toggle')
    await wrapper.vm.$nextTick()
    expect(expanders[0]?.props('collapsed')).toBe(true)
    expect(expanders[1]?.props('collapsed')).toBe(false)

    const treeData = wrapper.findAllComponents(OcTree)[0]!.props('data')
    expect(treeData.rootKeys).toEqual(['icon:0', 'icon:1'])
    expect(treeData.children.size).toBe(0)
    expect(treeData.items.get('icon:0')?.draggable).toBe(true)
    wrapper.unmount()
  })

  it('edits the selected icon through PropertyEditor and allows duplicate display names', async () => {
    const wrapper = mount(ProjectIconSeriesEditor, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    wrapper.findAllComponents(OcTree)[0]!.vm.$emit('intent', {
      type: 'selection.change', triggerKey: 'icon:1', selectedKeys: ['icon:1'], mode: 'replace',
    })
    await wrapper.vm.$nextTick()
    const inspector = wrapper.findAllComponents(PropertyEditor)[0]!
    expect(inspector.props('inputs')[0]?.record.name).toBe('Second')
    expect(inspector.props('inputs')[0]?.fields.name.commitMode).toBe('blur')
    expect(inspector.props('inputs')[0]?.fields.iconKey.commitMode).toBe('blur')

    inspector.vm.$emit('update-property', { key: 'icon:0:1', fieldKey: 'name', value: 'Same name' })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(updated[0]?.icons.map(icon => icon.name)).toEqual(['Same name', 'Same name'])
    wrapper.unmount()
  })

  it('reports duplicate icon keys without blocking the draft update', async () => {
    const wrapper = mount(ProjectIconSeriesEditor, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    const inspector = wrapper.findAllComponents(PropertyEditor)[0]!
    inspector.vm.$emit('update-property', { key: 'icon:0:0', fieldKey: 'iconKey', value: 'two' })
    await wrapper.vm.$nextTick()

    const conflictEvents = wrapper.emitted('key-conflicts') ?? []
    const conflicts = conflictEvents[conflictEvents.length - 1]?.[0]
    expect(conflicts).toEqual([
      { kind: 'icon', seriesIndex: 0, iconIndex: 0, key: 'two' },
      { kind: 'icon', seriesIndex: 0, iconIndex: 1, key: 'two' },
    ])
    const updateEvents = wrapper.emitted('update:series') ?? []
    const updated = updateEvents[updateEvents.length - 1]?.[0] as ProjectIconSeries[]
    expect(updated[0]?.icons.map(icon => icon.iconKey)).toEqual(['two', 'two'])
    wrapper.unmount()
  })

  it('applies OcTree reposition intents to persisted icon order', async () => {
    const wrapper = mount(ProjectIconSeriesEditor, {
      props: { series, resolveAssetSrc: source => `asset://${source}` },
    })
    wrapper.findAllComponents(OcTree)[0]!.vm.$emit('intent', {
      type: 'move.request', key: 'icon:0', targetKey: 'icon:1', position: 'after',
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(updated[0]?.icons.map(icon => icon.iconKey)).toEqual(['two', 'one'])
    wrapper.unmount()
  })

  it('persists preview grid controls and exposes the snap button as a toggle', async () => {
    const wrapper = mount(ProjectIconSeriesEditor, {
      props: {
        series: [{ ...series[0]!, grid: { snapToGrid: false, rows: 2, columns: 3, pixelated: false } }],
        resolveAssetSrc: source => `asset://${source}`,
      },
    })
    const toolbar = wrapper.getComponent(OcOverlayToolbar)
    const snapButton = toolbar.get('button[aria-label="projectConfig.icons.snapToGrid"]')
    await snapButton.trigger('click')
    let updates = wrapper.emitted('update:series') ?? []
    const firstUpdate = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(firstUpdate[0]?.grid).toEqual({ snapToGrid: true, rows: 2, columns: 3, pixelated: false })

    const inputs = toolbar.findAll('input')
    await inputs[0]!.setValue('5')
    await inputs[0]!.trigger('change')
    updates = wrapper.emitted('update:series') ?? []
    const secondUpdate = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(secondUpdate[0]?.grid).toEqual({ snapToGrid: true, rows: 5, columns: 3, pixelated: false })

    wrapper.getComponent(ProjectIconCropEditor).vm.$emit('update:pixelated', true)
    await wrapper.vm.$nextTick()
    updates = wrapper.emitted('update:series') ?? []
    const thirdUpdate = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(thirdUpdate[0]?.grid).toEqual({ snapToGrid: true, rows: 5, columns: 3, pixelated: true })
    wrapper.unmount()
  })
})
