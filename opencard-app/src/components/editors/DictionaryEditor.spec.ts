import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import DictionaryEditor from './DictionaryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

function latestDictionary(wrapper: ReturnType<typeof mount>) {
  const updates = wrapper.emitted('update:modelValue') ?? []
  return JSON.parse(updates[updates.length - 1]?.[0] as string)
}

describe('DictionaryEditor', () => {
  it('adds records and language columns', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: { filePath: 'D:/Demo/.dictionary', modelValue: '{}' },
    })
    const forms = wrapper.findAll('.dictionary-editor__create-actions form')
    await forms[0].get('input').setValue('title')
    await forms[0].get('button').trigger('click')
    expect(latestDictionary(wrapper)).toEqual({ base: { title: '' } })

    await forms[1].get('input').setValue('en_US')
    await forms[1].get('button').trigger('click')
    expect(latestDictionary(wrapper)).toEqual({
      base: { title: '' },
      languages: { en_US: {} },
    })
  })

  it('shows inherited values, creates overrides, and resets them', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({ base: { title: '默认' }, languages: { en_US: {} } }),
      },
    })
    const languageInput = wrapper.findAll('tbody input')[1]
    expect(languageInput.attributes('value')).toBe('默认')
    expect(languageInput.classes()).toContain('is-inherited')

    await languageInput.setValue('English')
    expect(latestDictionary(wrapper).languages.en_US).toEqual({ title: 'English' })
    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.resetOverride"]').trigger('click')
    expect(latestDictionary(wrapper).languages.en_US).toEqual({})
  })

  it('sets and clears the active language in the draft', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({ languages: { en_US: {} } }),
      },
    })
    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.setActive"]').trigger('click')
    expect(latestDictionary(wrapper).active).toBe('en_US')
    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.useBase"]').trigger('click')
    expect(latestDictionary(wrapper)).not.toHaveProperty('active')
  })

  it('renames and deletes records across all overrides', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({
          base: { title: '默认' },
          languages: { en_US: { title: 'English' } },
        }),
      },
    })
    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.renameRecord"]').trigger('click')
    const renameForm = wrapper.get('tbody .dictionary-editor__rename')
    await renameForm.get('input').setValue('heading')
    await renameForm.get('button').trigger('click')
    expect(latestDictionary(wrapper)).toEqual({
      base: { heading: '默认' },
      languages: { en_US: { heading: 'English' } },
    })

    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.deleteRecord"]').trigger('click')
    expect(latestDictionary(wrapper)).toEqual({ languages: { en_US: {} } })
  })

  it('uses source repair mode for invalid content', () => {
    const wrapper = mount(DictionaryEditor, {
      props: { filePath: 'D:/Demo/.dictionary', modelValue: '{broken' },
    })
    expect(wrapper.find('.dictionary-editor__repair').exists()).toBe(true)
    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
  })

  it('reports a missing active language without changing the draft', () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({ active: 'fr_FR', base: { title: 'Default' } }),
      },
    })
    expect(wrapper.find('.dictionary-editor__warning').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
