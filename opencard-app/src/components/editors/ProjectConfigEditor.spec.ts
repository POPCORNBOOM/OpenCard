import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectConfigEditor from './ProjectConfigEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

const content = JSON.stringify({
  version: 1,
  project: { name: 'Demo', description: '' },
  workspace: { indexedEntries: [], expandedDirectories: ['assets'] },
})

describe('ProjectConfigEditor', () => {
  it('edits project information without exposing or dropping workspace state', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardproject', modelValue: content },
    })

    await wrapper.findAll('input')[0].setValue('Renamed')

    const emittedContent = wrapper.emitted('update:modelValue')?.[0]?.[0] as string
    expect(JSON.parse(emittedContent)).toMatchObject({
      project: { name: 'Renamed' },
      workspace: { expandedDirectories: ['assets'] },
    })
    expect(wrapper.text()).not.toContain('expandedDirectories')
  })

  it('emits the standard save command from Ctrl+S', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardproject', modelValue: content },
    })

    await wrapper.get('.project-config-editor').trigger('keydown', { ctrlKey: true, key: 's' })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('edits a declared project field through the shared property protocol', async () => {
    const customContent = JSON.stringify({
      version: 1,
      project: {
        name: 'Demo',
        description: '',
        author: 'Alice',
        additionalFieldDefinition: {
          author: { fieldType: 'string', title: 'Author' },
        },
      },
      workspace: { indexedEntries: [], expandedDirectories: [] },
    })
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardproject', modelValue: customContent },
    })

    await wrapper.get('[data-field-key="author"] input').setValue('Bob')

    const emittedContent = wrapper.emitted('update:modelValue')?.[0]?.[0] as string
    expect(JSON.parse(emittedContent).project).toMatchObject({
      author: 'Bob',
      additionalFieldDefinition: {
        author: { fieldType: 'string', title: 'Author' },
      },
    })
  })

  it('creates a project field from the editor header action', async () => {
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardproject', modelValue: content },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.get('.project-config-editor__add-property').trigger('click')
    const dialogInputs = wrapper.findAll('[role="dialog"] input')
    await dialogInputs[0].setValue('author')
    await dialogInputs[1].setValue('Author')
    await wrapper.get('[role="dialog"] form, form[role="dialog"]').trigger('submit')

    const emissions = wrapper.emitted('update:modelValue') ?? []
    const emittedContent = emissions[emissions.length - 1]?.[0] as string
    expect(JSON.parse(emittedContent).project).toMatchObject({
      author: '',
      additionalFieldDefinition: {
        author: { fieldType: 'string', title: 'Author' },
      },
    })
  })

  it('deletes a project field after the shared two-click confirmation', async () => {
    const customContent = JSON.stringify({
      version: 1,
      project: {
        name: 'Demo',
        description: '',
        author: 'Alice',
        additionalFieldDefinition: {
          author: { fieldType: 'string', title: 'Author' },
        },
      },
      workspace: { indexedEntries: [], expandedDirectories: [] },
    })
    const wrapper = mount(ProjectConfigEditor, {
      props: { filePath: 'D:/Demo/.opencardproject', modelValue: customContent },
    })

    const deleteButton = wrapper.get('[data-field-key="author"] .delete-field-button')
    await deleteButton.trigger('click')
    await deleteButton.trigger('click')

    const emissions = wrapper.emitted('update:modelValue') ?? []
    const project = JSON.parse(emissions[emissions.length - 1]?.[0] as string).project
    expect(project).not.toHaveProperty('author')
    expect(project).not.toHaveProperty('additionalFieldDefinition')
  })
})
