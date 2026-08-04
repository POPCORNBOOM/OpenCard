import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectIconRegistryFileEditor from './ProjectIconRegistryFileEditor.vue'
import ProjectIconRegistryWorkbench from './ProjectIconRegistryWorkbench.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))
vi.mock('../../features/workspace/services/projectIconCatalog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/workspace/services/projectIconCatalog')>()
  return {
    ...actual,
    buildProjectIconCatalog: vi.fn(async () => ({ series: [], entries: [], errors: [] })),
  }
})

describe('ProjectIconRegistryFileEditor', () => {
  it('owns icon-series edits', async () => {
    const wrapper = mount(ProjectIconRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.ocicons', modelValue: '{}' },
    })
    wrapper.getComponent(ProjectIconRegistryWorkbench).vm.$emit('update:series', [{
      name: 'Status icons', key: 'status', source: 'assets/icons/status.png', icons: [],
    }])
    await wrapper.vm.$nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({
      iconSeries: [{ name: 'Status icons', key: 'status', source: 'assets/icons/status.png', icons: [] }],
    })
  })

  it('reports duplicate keys and blocks save', async () => {
    const icon = { iconKey: 'same', name: '', x: 0, y: 0, width: 8, height: 8 }
    const wrapper = mount(ProjectIconRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.ocicons',
        modelValue: JSON.stringify({
          iconSeries: [{ name: 'Status icons', key: 'status', source: 'status.png', icons: [icon, { ...icon, x: 8 }] }],
        }),
      },
    })
    wrapper.getComponent(ProjectIconRegistryWorkbench).vm.$emit('key-conflicts', [
      { kind: 'icon', seriesIndex: 0, iconIndex: 0, key: 'same' },
      { kind: 'icon', seriesIndex: 0, iconIndex: 1, key: 'same' },
    ])
    await wrapper.vm.$nextTick()

    const snapshots = wrapper.emitted('issue-snapshot') ?? []
    const latest = snapshots[snapshots.length - 1]?.[0] as { issues: Array<{ type: string }> }
    expect(latest.issues).toHaveLength(2)
    expect(latest.issues[0]?.type).toBe('project-icon-registry.icon.duplicate-key')
    await wrapper.get('.project-registry-shell').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('uses raw repair mode for invalid JSON', () => {
    const wrapper = mount(ProjectIconRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.ocicons', modelValue: '{broken' },
    })
    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
  })
})
