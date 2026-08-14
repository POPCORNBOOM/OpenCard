import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistryFileEditor from './ProjectFontRegistryFileEditor.vue'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'
import ProjectFontRegistrationDialog from './ProjectFontRegistrationDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

const face = (source: string) => ({
  source,
  weight: { min: 400, max: 400 },
  stretch: { min: 100, max: 100 },
  style: { kind: 'normal' as const },
})

describe('ProjectFontRegistryFileEditor', () => {
  it('owns independent family and composition edits and targets family configuration', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.opencard/.ocfonts',
        modelValue: JSON.stringify({
          families: [{ key: 'brand-regular', name: 'Regular', faces: [face('fonts/Brand.woff2')] }],
          compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'brand-regular' }] }],
        }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    const workbench = wrapper.getComponent(ProjectFontRegistryEditor)
    workbench.vm.$emit('configure-family', 'brand-regular')
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent(ProjectFontRegistrationDialog).props('originalKey')).toBe('brand-regular')

    workbench.vm.$emit('update:families', [
      { key: 'display', name: 'Display', faces: [face('fonts/Display.woff2')] },
    ])
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({
      families: [{ key: 'display', name: 'Display', faces: [face('fonts/Display.woff2')] }],
      compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'brand-regular' }] }],
    })

    workbench.vm.$emit('update:compositions', [
      { key: 'heading', name: 'Heading', members: [{ familyKey: 'display' }] },
    ])
    await wrapper.vm.$nextTick()
    const modelUpdates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(modelUpdates[modelUpdates.length - 1]?.[0] as string)).toEqual({
      families: [{ key: 'display', name: 'Display', faces: [face('fonts/Display.woff2')] }],
      compositions: [{ key: 'heading', name: 'Heading', members: [{ familyKey: 'display' }] }],
    })
  })

  it('uses raw repair mode for invalid JSON, ignores unknown fields, and saves current content', async () => {
    const invalid = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.opencard/.ocfonts', modelValue: '{broken' },
    })
    expect(invalid.find('.monaco-stub').exists()).toBe(true)

    const unknownShape = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.opencard/.ocfonts', modelValue: JSON.stringify({ fonts: [] }) },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    expect(unknownShape.find('.monaco-stub').exists()).toBe(false)

    const empty = mount(ProjectFontRegistryFileEditor, {
      props: { filePath: 'D:/Demo/.opencard/.ocfonts', modelValue: '{}' },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    expect(empty.getComponent(ProjectFontRegistryEditor).props('families')).toEqual([])
    expect(empty.getComponent(ProjectFontRegistryEditor).props('compositions')).toEqual([])
    await empty.get('.project-registry-shell').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(empty.emitted('save')).toHaveLength(1)
  })

  it('reports empty entries and missing family references without blocking save', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.opencard/.ocfonts',
        modelValue: JSON.stringify({
          families: [{ key: 'empty', name: 'Empty', faces: [] }],
          compositions: [
            { key: 'unused', name: 'Unused', members: [] },
            { key: 'body', name: 'Body', members: [{ familyKey: 'missing' }] },
          ],
        }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    const snapshots = wrapper.emitted('issue-snapshot') ?? []
    const snapshot = snapshots[snapshots.length - 1]?.[0] as { issues: { type: string }[] }
    expect(snapshot.issues.map(issue => issue.type)).toEqual(expect.arrayContaining([
      'project-font-registry.empty-family',
      'project-font-registry.empty-composition',
      'project-font-registry.missing-family',
    ]))
    await wrapper.get('.project-registry-shell').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('updates composition references when a family key changes', async () => {
    const wrapper = mount(ProjectFontRegistryFileEditor, {
      props: {
        filePath: 'D:/Demo/.opencard/.ocfonts',
        modelValue: JSON.stringify({
          families: [{ key: 'latin', name: 'Latin', faces: [face('fonts/Latin.woff2')] }],
          compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'latin' }] }],
        }),
      },
      global: { stubs: { ProjectFontRegistryEditor: true } },
    })
    wrapper.getComponent(ProjectFontRegistrationDialog).vm.$emit('submit', {
      originalKey: 'latin',
      key: 'foundation',
      name: 'Foundation',
      sourcePath: 'fonts/Latin.woff2',
      weight: { min: 400, max: 400 },
      stretch: { min: 100, max: 100 },
      style: { kind: 'normal' },
    })
    await wrapper.vm.$nextTick()
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string).compositions).toEqual([
      { key: 'body', name: 'Body', members: [{ familyKey: 'foundation' }] },
    ])
  })
})
