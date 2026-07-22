import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectConfigEditor from './ProjectConfigEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

const content = JSON.stringify({
  version: 1,
  project: { name: 'Demo', description: '', entry: 'main.opencard' },
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
        entry: 'main.opencard',
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
})
