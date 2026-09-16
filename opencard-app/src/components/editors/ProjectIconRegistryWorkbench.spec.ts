import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import type { ProjectIconSeries } from '../../features/workspace/model/projectIcons'
import ProjectIconView from '../../features/workspace/components/ProjectIconView.vue'
import type { ProjectIconCatalogEntry } from '../../features/workspace/services/projectIconCatalog'
import PropertyEditor from '../../shared/ui/property-editor/PropertyEditor.vue'
import OcTree from '../standard/OcTree.vue'
import OcViewportInspector from '../standard/OcViewportInspector.vue'
import ProjectIconRegistryWorkbench from './ProjectIconRegistryWorkbench.vue'
import ProjectIconSetSettingsDialog from './ProjectIconSetSettingsDialog.vue'
import ProjectIconSetWorkspace from './ProjectIconSetWorkspace.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/services/projectIconCatalog')>()
  return {
    ...actual,
    // Assembling the catalog is synchronous plain-data work; only the sizes arrive later.
    buildProjectIconCatalog: vi.fn((series: readonly ProjectIconSeries[], resolve: (source: string) => string) => {
      const entries: ProjectIconCatalogEntry[] = []
      const runtimeSeries = series.map(candidate => {
        for (const icon of candidate.icons) {
          entries.push({
            ...icon, seriesKey: candidate.key, src: resolve(icon.source), imageWidth: 24, imageHeight: 24,
          })
        }
        return { name: candidate.name, key: candidate.key }
      })
      return { series: runtimeSeries, entries, errors: [] }
    }),
  }
})

const series: ProjectIconSeries[] = [
  {
    name: 'Status icons', key: 'status',
    icons: [{ iconKey: 'warning', name: 'Warning', source: '.opencard/icons/status/warning.svg', tint: 'theme' }],
  },
  { name: 'Action icons', key: 'actions', icons: [] },
]
const projectIconCatalog = {
  series: [{ name: 'Status icons', key: 'status' }],
  entries: [],
  errors: [],
}
const baseProps = {
  series,
  resolveAssetSrc: (source: string) => `asset://${source}`,
}
/** The given set plus two more icons, so a delete leaves a neighbor for the selection to move to. */
function iconsOf(candidate: ProjectIconSeries): ProjectIconSeries['icons'] {
  return [
    ...candidate.icons,
    { iconKey: 'success', name: 'Success', source: '.opencard/icons/status/success.svg', tint: 'original' },
    { iconKey: 'info', name: 'Info', source: '.opencard/icons/status/info.svg', tint: 'theme' },
  ]
}

describe('ProjectIconRegistryWorkbench', () => {
  it('opens the first expander with the icon list on the left and a stage plus properties on the right', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.project-icon-registry-workbench__placeholder').exists()).toBe(false)
    expect(wrapper.get('.project-config-section__heading').text()).toContain('Status icons')
    expect(wrapper.getComponent(ProjectIconSetWorkspace).props()).toMatchObject({
      series: series[0],
      selectedIconIndexes: [0],
    })
    expect(wrapper.getComponent(ProjectIconView).props('mode')).toBe('preview')
    const inspector = wrapper.getComponent(OcViewportInspector)
    expect(inspector.props()).toMatchObject({
      expanded: true, height: null, heading: 'cardDesigner.panels.properties',
    })
    const editor = wrapper.getComponent(PropertyEditor)
    const categories = editor.props('categories') as ReadonlyMap<string, unknown>
    expect(editor.props('inputs')[0]?.record.name).toBe('Warning')
    expect(editor.props('sortMode')).toBe('category')
    expect([...categories.keys()]).toEqual(['identity', 'appearance'])
  })

  it('keeps the properties pane layout while switching icon sets', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog },
    })
    const inspector = wrapper.getComponent(OcViewportInspector)
    inspector.vm.$emit('update:height', 300)
    inspector.vm.$emit('update:expanded', false)
    await (wrapper.vm as unknown as { selectSeries(key: string): Promise<boolean> }).selectSeries('actions')
    await wrapper.vm.$nextTick()

    expect(wrapper.getComponent(OcViewportInspector).props()).toMatchObject({ height: 300, expanded: false })
  })

  it('leaves pack creation to the editor shell actions', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('button[aria-label="projectConfig.icons.createPack"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="projectConfig.icons.importPack"]').exists()).toBe(false)
  })

  it('offers no crop or even-grid actions now that every icon is its own file', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('button[aria-label="projectConfig.icons.addSingleCrop"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="projectConfig.icons.generateIcons"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="projectConfig.icons.exportPack"]').exists()).toBe(true)
  })

  it('disables the export command while an icon-pack task owns the progress bar', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, projectIconCatalog, packBusy: true },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.get('button[aria-label="projectConfig.icons.exportPack"]').attributes('disabled')).toBeDefined()
  })

  it('replaces only the expanded series when one set changes', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await (wrapper.vm as unknown as { selectSeries(key: string): Promise<boolean> }).selectSeries('status')
    const updatedStatus = { ...series[0]!, icons: [{ ...series[0]!.icons[0]!, name: 'Alert' }] }
    wrapper.getComponent(ProjectIconSetWorkspace).vm.$emit('update:series', updatedStatus)
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:series') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual([updatedStatus, series[1]])
  })

  it('requests removal from the owner instead of dropping a set on its own', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button[aria-label="projectConfig.icons.removeSeries"]')[0]!.trigger('click')
    await wrapper.vm.$nextTick()

    // Removing files needs confirmation and staging, so the owner decides; the workbench only asks.
    expect(wrapper.emitted('remove-series')).toEqual([[series[0]!.key]])
    expect(wrapper.emitted('update:series')).toBeUndefined()
  })

  it('reports the selected set runtime and its icons to the workspace', async () => {
    const twoIcons: ProjectIconSeries[] = [{
      ...series[0]!,
      icons: [
        series[0]!.icons[0]!,
        { iconKey: 'error', name: 'Error', source: '.opencard/icons/status/error.svg', tint: 'original' },
      ],
    }]
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, series: twoIcons },
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.getComponent(ProjectIconSetWorkspace).props('entries')).toHaveLength(2)
    expect(wrapper.getComponent(ProjectIconView).props('entry')).toMatchObject({ iconKey: 'warning' })
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
    const revealed = wrapper.get('.property-editor__row.is-revealed')
    expect(revealed.attributes('data-input-key')).toBe('icon:0')
    expect(revealed.attributes('data-field-key')).toBe('iconKey')
  })

  it('shows the icon the list selects, using the first of a multiple selection', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, series: [{ ...series[0]!, icons: iconsOf(series[0]!) }] },
    })
    await wrapper.vm.$nextTick()
    const workspace = wrapper.getComponent(ProjectIconSetWorkspace)

    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Warning')

    workspace.vm.$emit('update:selectedIconIndexes', [0, 2])
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Warning')

    workspace.vm.$emit('update:selectedIconIndexes', [1])
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Success')
  })

  it('edits the selected icon through the properties pane without mutating the incoming set', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await wrapper.vm.$nextTick()

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'name', value: 'Alert',
    })
    await wrapper.vm.$nextTick()
    const renamedUpdates = wrapper.emitted('update:series') ?? []
    const renamed = renamedUpdates[renamedUpdates.length - 1]?.[0] as ProjectIconSeries[]
    expect(renamed[0]?.icons[0]?.name).toBe('Alert')
    expect(series[0]?.icons[0]?.name).toBe('Warning')

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'rotation', value: '90°',
    })
    await wrapper.vm.$nextTick()
    const rotatedUpdates = wrapper.emitted('update:series') ?? []
    const rotated = rotatedUpdates[rotatedUpdates.length - 1]?.[0] as ProjectIconSeries[]
    expect(rotated[0]?.icons[0]?.rotation).toBe(90)
  })

  it('exposes tint and pixelated instead of crop geometry', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await wrapper.vm.$nextTick()

    const fields = wrapper.getComponent(PropertyEditor).props('inputs')[0]?.fields
    expect(fields).toHaveProperty('tint')
    expect(fields).toHaveProperty('pixelated')
    expect(fields).not.toHaveProperty('x')

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'tint', value: 'original',
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(updated[0]?.icons[0]).toMatchObject({ tint: 'original' })
  })

  it('marks a raster icon pixelated through its own property', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: {
        ...baseProps,
        series: [{
          name: 'Pixels', key: 'pixels',
          icons: [{ iconKey: 'coin', name: 'Coin', source: '.opencard/icons/pixels/coin.png', tint: 'original' }],
        }],
      },
    })
    await wrapper.vm.$nextTick()

    wrapper.getComponent(PropertyEditor).vm.$emit('update-property', {
      key: 'icon:0', fieldKey: 'pixelated', value: 'true',
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const updated = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(updated[0]?.icons[0]).toMatchObject({ pixelated: true })
  })

  it('follows the list selection after a delete moves it to the next icon', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, series: [{ ...series[0]!, icons: iconsOf(series[0]!) }] },
    })
    await wrapper.vm.$nextTick()
    wrapper.getComponent(ProjectIconSetWorkspace).vm.$emit('update:selectedIconIndexes', [1])
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Success')

    wrapper.getComponent(OcTree).vm.$emit('action', {
      key: 'icon:1', actionKey: 'delete', source: 'inline',
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:series') ?? []
    const nextSeries = updates[updates.length - 1]?.[0] as ProjectIconSeries[]
    expect(nextSeries[0]?.icons.map(icon => icon.iconKey)).toEqual(['warning', 'info'])

    await wrapper.setProps({ series: nextSeries })
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(PropertyEditor).props('inputs')[0]?.record.name).toBe('Info')
  })

  it('keeps the no-icon empty state in the properties pane when the set has no icons', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: { ...baseProps, series: [{ name: 'Action icons', key: 'actions', icons: [] }] },
    })
    await wrapper.vm.$nextTick()

    const pane = wrapper.get('.project-icon-registry-workbench__property-content')
    expect(pane.findComponent(PropertyEditor).exists()).toBe(false)
    expect(pane.text()).toContain('projectConfig.icons.noIconSelected')
  })

  it('renames a set through its settings without touching icon files', async () => {
    const wrapper = mount(ProjectIconRegistryWorkbench, {
      props: baseProps,
    })
    await (wrapper.vm as unknown as { selectSeries(key: string): Promise<boolean> }).selectSeries('status')
    await wrapper.findAll('button[aria-label="projectConfig.icons.configureIconSet"]')[0]!.trigger('click')
    await wrapper.vm.$nextTick()

    const dialog = wrapper.getComponent(ProjectIconSetSettingsDialog)
    dialog.vm.$emit('submit', { name: 'Renamed', key: 'renamed' })
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:series') ?? []
    expect(updates[updates.length - 1]?.[0]).toEqual([
      { ...series[0], name: 'Renamed', key: 'renamed' },
      series[1],
    ])
  })
})
