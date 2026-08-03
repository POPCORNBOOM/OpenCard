import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcActionButton from '../standard/OcActionButton.vue'
import DictionaryEditor from './DictionaryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

const clipboard = {
  readText: vi.fn<() => Promise<string>>(),
  writeText: vi.fn<(value: string) => Promise<void>>(),
}

function latestDictionary(wrapper: ReturnType<typeof mount>) {
  const updates = wrapper.emitted('update:modelValue') ?? []
  return JSON.parse(updates[updates.length - 1]?.[0] as string)
}

function actionButton(wrapper: ReturnType<typeof mount>, title: string) {
  return wrapper.findAllComponents(OcActionButton).find(candidate => candidate.props('action').title === title)!
}

describe('DictionaryEditor', () => {
  beforeEach(() => {
    clipboard.readText.mockReset()
    clipboard.writeText.mockReset().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
  })

  it('adds records and language columns in place inside the grid', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: { filePath: 'D:/Demo/.dictionary', modelValue: '{}' },
    })
    await wrapper.get('tbody button').trigger('click')
    const recordForm = wrapper.get('tbody .dictionary-editor__inline-create')
    await recordForm.get('input').setValue('title')
    await recordForm.trigger('submit')
    expect(latestDictionary(wrapper)).toEqual({ base: { title: '' } })

    await wrapper.get('button[data-tooltip="dictionaryEditor.actions.addLanguage"]').trigger('click')
    const languageForm = wrapper.get('thead .dictionary-editor__inline-create')
    await languageForm.get('input').setValue('en_US')
    await languageForm.trigger('submit')
    expect(latestDictionary(wrapper)).toEqual({
      base: { title: '' },
      languages: { en_US: {} },
    })
  })

  it('uses embedded fields, shows inheritance, creates overrides, and resets them', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({ base: { title: '默认' }, languages: { en_US: {} } }),
      },
    })
    const languageCell = wrapper.get('td[data-grid-column="en_US"]')
    expect(languageCell.classes()).toContain('is-inherited')
    expect(languageCell.find('.property-field-renderer--embedded').exists()).toBe(true)
    expect(languageCell.get('input').attributes('value')).toBe('默认')

    await languageCell.get('input').setValue('English')
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

  it('keeps language header actions together in one trailing group', () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({ languages: { en_US: {} } }),
      },
    })
    const languageHeader = wrapper.get('th.dictionary-editor__data-column:nth-of-type(3)')
    const actionGroup = languageHeader.get('.dictionary-editor__column-actions')
    expect(actionGroup.findAll('button')).toHaveLength(2)
    expect(languageHeader.get('.dictionary-editor__column-heading').element.children).toHaveLength(2)
  })

  it('routes rename and confirmed batch deletion through standard action buttons', async () => {
    const wrapper = mount(DictionaryEditor, {
      attachTo: document.body,
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({
          base: { title: '默认', body: '正文' },
          languages: { en_US: { title: 'English' } },
        }),
      },
    })
    actionButton(wrapper, 'dictionaryEditor.actions.recordActions').vm.$emit('select', { key: 'rename' })
    await wrapper.vm.$nextTick()
    const recordRenameInput = wrapper.get('tbody .dictionary-editor__rename input')
    await recordRenameInput.setValue('heading')
    await recordRenameInput.trigger('blur')
    expect(latestDictionary(wrapper)).toEqual({
      base: { heading: '默认', body: '正文' },
      languages: { en_US: { heading: 'English' } },
    })

    actionButton(wrapper, 'dictionaryEditor.actions.languageActions').vm.$emit('select', { key: 'rename' })
    await wrapper.vm.$nextTick()
    const languageRenameInput = wrapper.get('thead .dictionary-editor__rename input')
    await languageRenameInput.setValue('en_GB')
    await languageRenameInput.trigger('blur')
    expect(latestDictionary(wrapper).languages).toEqual({ en_GB: { heading: 'English' } })

    const rowHeaders = wrapper.findAll('tbody th[scope="row"]')
    await rowHeaders[0]!.trigger('click')
    await rowHeaders[1]!.trigger('click', { ctrlKey: true })
    actionButton(wrapper, 'dictionaryEditor.actions.recordActions').vm.$emit('select', { key: 'confirm-delete' })
    await wrapper.vm.$nextTick()
    expect(latestDictionary(wrapper)).toEqual({ languages: { en_GB: {} } })
    wrapper.unmount()
  })

  it('copies effective values as TSV and pastes a matrix with one dictionary write', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({
          base: { title: '默认', body: '正文' },
          languages: { en_US: { title: 'English' } },
        }),
      },
    })
    const first = wrapper.get('td[data-grid-row="title"][data-grid-column="$base"]')
    const last = wrapper.get('td[data-grid-row="body"][data-grid-column="en_US"]')
    await first.trigger('click')
    await last.trigger('click', { shiftKey: true })
    await wrapper.get('.dictionary-editor').trigger('keydown', { key: 'c', ctrlKey: true })
    await flushPromises()
    expect(clipboard.writeText).toHaveBeenCalledWith('默认\tEnglish\n正文\t正文')

    clipboard.readText.mockResolvedValue('Base\tEnglish 2\r\nBody\tBody 2')
    await first.trigger('click')
    const updateCount = wrapper.emitted('update:modelValue')?.length ?? 0
    await wrapper.get('.dictionary-editor').trigger('keydown', { key: 'v', ctrlKey: true })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toHaveLength(updateCount + 1)
    expect(latestDictionary(wrapper)).toEqual({
      base: { title: 'Base', body: 'Body' },
      languages: { en_US: { title: 'English 2', body: 'Body 2' } },
    })
  })

  it('clears base cells and language overrides according to their semantics', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.dictionary',
        modelValue: JSON.stringify({ base: { title: '默认' }, languages: { en_US: { title: 'English' } } }),
      },
    })
    const baseCell = wrapper.get('td[data-grid-column="$base"]')
    const languageCell = wrapper.get('td[data-grid-column="en_US"]')
    await baseCell.trigger('click')
    await languageCell.trigger('click', { shiftKey: true })
    await wrapper.get('.dictionary-editor').trigger('keydown', { key: 'Delete' })
    expect(latestDictionary(wrapper)).toEqual({ base: { title: '' }, languages: { en_US: {} } })
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
    expect(wrapper.find('.dictionary-editor__notice').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
