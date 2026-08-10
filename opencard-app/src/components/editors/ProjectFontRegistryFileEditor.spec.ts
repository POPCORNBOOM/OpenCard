import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistryFileEditor from './ProjectFontRegistryFileEditor.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import ProjectFontRegistrationDialog from './ProjectFontRegistrationDialog.vue'
import ProjectFontSetDialog from './ProjectFontSetDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

describe('ProjectFontRegistryFileEditor', () => {
  it('owns independent font and font-set edits and targets font configuration', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.ocfonts',
        modelValue: JSON.stringify({
          fonts: [{ key: 'brand-regular', name: 'Regular', source: 'assets/fonts/Brand.woff2' }],
          fontSets: [{ key: 'body', name: 'Body', fontKeys: ['brand-regular'] }],
        }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    const workbench = wrapper.getComponent(ProjectFontRegistryEditor)
    workbench.vm.$emit('configure-font', 'brand-regular')
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(ProjectFontRegistrationDialog).props('originalKey')).toBe('brand-regular')

    workbench.vm.$emit('update:fonts', [
      { key: 'display', name: 'Display', source: 'assets/fonts/Display.woff2' },
    ])
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({
      fonts: [{ key: 'display', name: 'Display', source: 'assets/fonts/Display.woff2' }],
      fontSets: [{ key: 'body', name: 'Body', fontKeys: ['brand-regular'] }],
    })

    workbench.vm.$emit('update:fontSets', [{ key: 'heading', name: 'Heading', fontKeys: ['display'] }])
    await wrapper.vm.$nextTick()
    const modelUpdates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(modelUpdates[modelUpdates.length - 1]?.[0] as string)).toEqual({
      fonts: [{ key: 'display', name: 'Display', source: 'assets/fonts/Display.woff2' }],
      fontSets: [{ key: 'heading', name: 'Heading', fontKeys: ['display'] }],
    })
  })

  it('uses raw repair mode for invalid JSON and saves valid content', async () => {
    const invalid = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.ocfonts', modelValue: '{broken' },
    })
    expect(invalid.find('.monaco-stub').exists()).toBe(true)

    const empty = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.ocfonts', modelValue: '{}' },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    expect(empty.find('.monaco-stub').exists()).toBe(false)
    expect(empty.getComponent(ProjectFontRegistryEditor).props('fonts')).toEqual([])
    expect(empty.getComponent(ProjectFontRegistryEditor).props('fontSets')).toEqual([])

    const valid = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.ocfonts',
        modelValue: JSON.stringify({ fonts: [{ key: 'brand', name: 'Brand', source: 'Brand.woff2' }] }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    await valid.get('.project-registry-shell').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(valid.emitted('save')).toHaveLength(1)
  })

  it('reports missing and cyclic font-set references without blocking save', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.ocfonts',
        modelValue: JSON.stringify({
          fontSets: [
            { key: 'a', name: 'A', fontKeys: ['b', 'missing'] },
            { key: 'b', name: 'B', fontKeys: ['a'] },
          ],
        }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    const snapshots = wrapper.emitted('issue-snapshot') ?? []
    const snapshot = snapshots[snapshots.length - 1]?.[0] as { issues: { type: string }[] }
    expect(snapshot.issues.some(issue => issue.type === 'project-font-registry.cycle')).toBe(true)
    expect(snapshot.issues.some(issue => issue.type === 'project-font-registry.missing')).toBe(true)
    await wrapper.get('.project-registry-shell').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('updates registry-local references when a font set key changes', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.ocfonts',
        modelValue: JSON.stringify({
          fonts: [{ key: 'latin', name: 'Latin', source: 'Latin.woff2' }],
          fontSets: [
            { key: 'base', name: 'Base', fontKeys: ['latin'] },
            { key: 'nested', name: 'Nested', fontKeys: ['base'] },
          ],
        }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    wrapper.getComponent(ProjectFontSetDialog).vm.$emit('submit', {
      originalKey: 'base', key: 'foundation', name: 'Foundation', fontKeys: ['latin'],
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string).fontSets).toEqual([
      { key: 'foundation', name: 'Foundation', fontKeys: ['latin'] },
      { key: 'nested', name: 'Nested', fontKeys: ['foundation'] },
    ])
  })

  it('projects both snapshots through one original font workbench', () => {
    const current = JSON.stringify({ fonts: [{ key: 'brand', name: 'Current', source: 'fonts/current.woff2' }] })
    const historical = JSON.stringify({ fonts: [{ key: 'brand', name: 'Historical', source: 'fonts/history.woff2' }] })
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/current/.ocfonts', modelValue: current, comparisonContent: historical,
        resourceRootPath: 'D:/current', comparisonResourceRootPath: 'D:/historical', access: 'observe-only',
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    const workbench = wrapper.getComponent(ProjectFontRegistryEditor)
    expect(workbench.props('fonts')[0]?.name).toBe('Current')
    expect(workbench.props('comparisonFonts')?.[0]?.name).toBe('Historical')
    expect(workbench.props('comparison')).toBe(true)
    expect(workbench.props('readOnly')).toBe(true)
  })
})
