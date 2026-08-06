import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontSetDialog from './ProjectFontSetDialog.vue'
import OcButton from '../base/OcButton.vue'
import OcAutocompletePopover from '../standard/OcAutocompletePopover.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const fonts = [
  { key: 'latin', name: 'Latin', source: 'Latin.woff2' },
  { key: 'cjk', name: 'CJK', source: 'CJK.woff2' },
]

describe('ProjectFontSetDialog', () => {
  it('requires one member on creation and preserves selection order', async () => {
    const wrapper = mount(ProjectFontSetDialog, {
      props: { open: true, fonts, fontSets: [] },
      global: { stubs: { Teleport: true, OcAutocompletePopover: true } },
    })
    expect(wrapper.findAll('input')[0]!.element.value).toBe('projectConfig.fonts.defaultSetName')
    await wrapper.get('.project-font-set-dialog__field input').setValue('Body')
    const buttons = wrapper.findAllComponents(OcButton)
    const submit = buttons[buttons.length - 1]!
    expect(submit.props('disabled')).toBe(true)

    const memberInput = wrapper.get('[role="combobox"]')
    await memberInput.setValue('CJK')
    await memberInput.trigger('keydown', { key: 'Enter' })
    await memberInput.setValue('Latin')
    await memberInput.trigger('keydown', { key: 'Enter' })
    expect(submit.props('disabled')).toBe(false)

    const rows = () => wrapper.findAll('.project-font-set-dialog__member-row')
    await rows()[1]!.get('[aria-label="projectConfig.fonts.moveMemberToTop"]').trigger('click')
    expect(rows().map(row => row.text())).toEqual(expect.arrayContaining([
      expect.stringContaining('Latin'),
      expect.stringContaining('CJK'),
    ]))
    expect(rows()[0]!.text()).toContain('Latin')
    await rows()[0]!.get('[aria-label="projectConfig.fonts.moveMemberToBottom"]').trigger('click')
    expect(rows()[0]!.text()).toContain('CJK')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      key: 'body',
      name: 'Body',
      fontKeys: ['cjk', 'latin'],
    })
  })

  it('allows an existing set to become empty and disables a cyclic set candidate', async () => {
    const wrapper = mount(ProjectFontSetDialog, {
      props: {
        open: true,
        fonts,
        originalKey: 'base',
        fontSets: [
          { key: 'base', name: 'Base', fontKeys: ['latin'] },
          { key: 'nested', name: 'Nested', fontKeys: ['base'] },
        ],
      },
      global: { stubs: { Teleport: true, OcAutocompletePopover: true } },
    })
    await wrapper.get('[role="combobox"]').trigger('focus')
    const suggestions = wrapper.getComponent(OcAutocompletePopover).props('items')
    expect(suggestions.map(item => item.label)).not.toContain('Nested')
    await wrapper.get('[aria-label="projectConfig.fonts.removeMember"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ originalKey: 'base', fontKeys: [] })
  })
})
