import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectConfigEditor from './ProjectConfigEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

describe('ProjectConfigEditor', () => {
  it('edits only project name, description, and version', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: {
        filePath: 'D:/Demo/.opencardprojectprofile',
        modelValue: JSON.stringify({ name: 'Demo', description: 'Info', version: '1.0.0' }),
      },
    })

    expect(wrapper.find('[data-field-key="extends"]').exists()).toBe(false)
    expect(wrapper.find('[data-field-key="globalvariables"]').exists()).toBe(false)
    await wrapper.get('[data-field-key="version"] input').setValue('2.0.0')

    const updates = wrapper.emitted('update:modelValue') ?? []
    const updated = updates[updates.length - 1]?.[0] as string
    expect(JSON.parse(updated)).toEqual({ name: 'Demo', description: 'Info', version: '2.0.0' })
  })

  it('omits empty profile fields', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{"name":"Demo"}' },
    })
    await wrapper.get('[data-field-key="name"] input').setValue('')
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({})
  })

  it('shows the embedded JSON repair editor for invalid content', () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{broken' },
    })
    expect(wrapper.find('.project-profile-editor__repair').exists()).toBe(true)
    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
  })

  it('emits the standard save command from Ctrl+S for valid content', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardprojectprofile', modelValue: '{}' },
    })
    await wrapper.get('.project-profile-editor').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })
})
