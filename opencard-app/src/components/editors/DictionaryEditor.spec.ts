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
      attachTo: document.body,
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
    expect(renameForm.find('button').exists()).toBe(false)
    const recordRenameInput = renameForm.get('input')
    ;(recordRenameInput.element as HTMLInputElement).focus()
    expect(document.activeElement).toBe(recordRenameInput.element)
    await recordRenameInput.setValue('heading')
    const baseValueInput = wrapper.get('tbody td input')
    ;(baseValueInput.element as HTMLInputElement).focus()
    expect(document.activeElement).toBe(baseValueInput.element)
    await wrapper.vm.$nextTick()
    expect(latestDictionary(wrapper)).toEqual({
      base: { heading: '默认' },
      languages: { en_US: { heading: 'English' } },
    })

    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.renameLanguage"]').trigger('click')
    const languageRenameForm = wrapper.get('thead .dictionary-editor__rename')
    const languageRenameInput = languageRenameForm.get('input')
    ;(languageRenameInput.element as HTMLInputElement).focus()
    await languageRenameInput.setValue('en_GB')
    ;(wrapper.get('tbody td input').element as HTMLInputElement).focus()
    await wrapper.vm.$nextTick()
    expect(latestDictionary(wrapper)).toEqual({
      base: { heading: '默认' },
      languages: { en_GB: { heading: 'English' } },
    })

    const updateCount = wrapper.emitted('update:modelValue')?.length
    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.renameRecord"]').trigger('click')
    await wrapper.get('tbody .dictionary-editor__rename input').setValue('cancelled')
    await wrapper.get('tbody .dictionary-editor__rename input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('tbody .dictionary-editor__rename').exists()).toBe(false)
    expect(wrapper.emitted('update:modelValue')).toHaveLength(updateCount ?? 0)

    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.deleteRecord"]').trigger('click')
    expect(latestDictionary(wrapper)).toEqual({ languages: { en_GB: {} } })
    wrapper.unmount()
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
