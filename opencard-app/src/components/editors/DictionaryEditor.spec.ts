import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcActionButton from '../standard/OcActionButton.vue'
import { fileSystemService } from '../../features/workspace/services/fileSystemService'
import { exportProjectDictionaryWorkbook } from '../../features/workspace/model/projectDictionaryWorkbook'
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
    vi.restoreAllMocks()
    clipboard.readText.mockReset()
    clipboard.writeText.mockReset().mockResolvedValue()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: clipboard })
  })

  it('does not add row, column, or cell selection states', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.oclocale',
        modelValue: JSON.stringify({ base: { title: 'Default' }, languages: { en_US: {} } }),
      },
    })
    await wrapper.get('tbody th[scope="row"]').trigger('click', { ctrlKey: true })
    await wrapper.get('th.dictionary-editor__data-column').trigger('click', { shiftKey: true })
    await wrapper.get('td[data-grid-column="$base"]').trigger('click', { shiftKey: true })

    expect(wrapper.find('[aria-selected]').exists()).toBe(false)
    expect(wrapper.find('.is-selected').exists()).toBe(false)
  })

  it('imports and exports dictionary workbooks through the exposed shell boundary', async () => {
    const bytes = await exportProjectDictionaryWorkbook({
      base: { title: 'Changed' },
      languages: { en_US: { title: 'English' } },
    }, { key: 'Key', base: 'Base' })
    vi.spyOn(fileSystemService, 'pickFile').mockResolvedValue('D:/Demo/dictionary.xlsx')
    vi.spyOn(fileSystemService, 'readBinaryFile').mockResolvedValue(bytes)
    vi.spyOn(fileSystemService, 'pickSavePath').mockResolvedValue('D:/Demo/export.xlsx')
    const writeBinaryFile = vi.spyOn(fileSystemService, 'writeBinaryFile').mockResolvedValue()
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.oclocale',
        modelValue: JSON.stringify({ base: { title: 'Default' } }),
      },
      global: { stubs: { Teleport: true } },
    })
    const editor = wrapper.vm as unknown as {
      importDataTableWorkbook: () => Promise<void>
      exportDataTableWorkbook: () => Promise<void>
    }

    await editor.exportDataTableWorkbook()
    expect(writeBinaryFile).toHaveBeenCalledWith('D:/Demo/export.xlsx', expect.any(Uint8Array))
    await editor.importDataTableWorkbook()
    await flushPromises()
    expect(wrapper.text()).toContain('dictionaryEditor.workbook.reviewTitle')
    await wrapper.get('button.oc-button--variant-solid').trigger('click')
    expect(latestDictionary(wrapper)).toEqual({
      base: { title: 'Changed' },
      languages: { en_US: { title: 'English' } },
    })
  })

  it('adds records and language columns in place inside the grid', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: { filePath: 'D:/Demo/.oclocale', modelValue: '{}' },
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
        filePath: 'D:/Demo/.oclocale',
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
        filePath: 'D:/Demo/.oclocale',
        modelValue: JSON.stringify({ languages: { en_US: {} } }),
      },
    })
    const setActive = wrapper.get('button[data-tooltip="dictionaryEditor.actions.setActive"]')
    await setActive.trigger('click')
    expect(latestDictionary(wrapper).active).toBe('en_US')
    expect(setActive.classes()).toContain('oc-button--active')
    const useBase = wrapper.get('button[data-tooltip="dictionaryEditor.actions.useBase"]')
    await useBase.trigger('click')
    expect(latestDictionary(wrapper)).not.toHaveProperty('active')
    expect(useBase.classes()).toContain('oc-button--active')
  })

  it('keeps language header actions together in one trailing group', () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.oclocale',
        modelValue: JSON.stringify({ languages: { en_US: {} } }),
      },
    })
    const languageHeader = wrapper.get('th.dictionary-editor__data-column:nth-of-type(3)')
    const actionGroup = languageHeader.get('.dictionary-editor__column-actions')
    expect(actionGroup.findAll('button')).toHaveLength(2)
    expect(languageHeader.get('.dictionary-editor__column-heading').element.children).toHaveLength(2)
  })

  it('routes rename and confirmed deletion through standard action buttons', async () => {
    const wrapper = mount(DictionaryEditor, {
      attachTo: document.body,
      props: {
        filePath: 'D:/Demo/.oclocale',
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

    actionButton(wrapper, 'dictionaryEditor.actions.recordActions').vm.$emit('select', { key: 'confirm-delete' })
    await wrapper.vm.$nextTick()
    expect(latestDictionary(wrapper)).toEqual({ base: { body: '正文' }, languages: { en_GB: {} } })
    wrapper.unmount()
  })

  it('copies record keys and language keys from their action menus', async () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.oclocale',
        modelValue: JSON.stringify({ base: { title: 'Default' }, languages: { en_US: {} } }),
      },
    })
    actionButton(wrapper, 'dictionaryEditor.actions.recordActions').vm.$emit('select', { key: 'copy' })
    await flushPromises()
    expect(clipboard.writeText).toHaveBeenCalledWith('title')

    actionButton(wrapper, 'dictionaryEditor.actions.languageActions').vm.$emit('select', { key: 'copy' })
    await flushPromises()
    expect(clipboard.writeText).toHaveBeenLastCalledWith('en_US')
  })

  it('uses source repair mode for invalid content', () => {
    const wrapper = mount(DictionaryEditor, {
      props: { filePath: 'D:/Demo/.oclocale', modelValue: '{broken' },
    })
    expect(wrapper.find('.dictionary-editor__repair').exists()).toBe(true)
    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
  })

  it('reports a missing active language without changing the draft', () => {
    const wrapper = mount(DictionaryEditor, {
      props: {
        filePath: 'D:/Demo/.oclocale',
        modelValue: JSON.stringify({ active: 'fr_FR', base: { title: 'Default' } }),
      },
    })
    expect(wrapper.find('.dictionary-editor__notice').exists()).toBe(true)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})
