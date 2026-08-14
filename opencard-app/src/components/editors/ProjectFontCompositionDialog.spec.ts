import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontCompositionDialog from './ProjectFontCompositionDialog.vue'
import OcButton from '../base/OcButton.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const face = (source: string) => ({
  source,
  weight: { min: 400, max: 400 },
  stretch: { min: 100, max: 100 },
  style: { kind: 'normal' as const },
})
const families = [
  { key: 'latin', name: 'Latin', faces: [face('fonts/Latin.woff2')] },
  { key: 'cjk', name: 'CJK', faces: [face('fonts/CJK.woff2')] },
]

describe('ProjectFontCompositionDialog', () => {
  it('requires one family and preserves member order', async () => {
    const wrapper = mount(ProjectFontCompositionDialog, {
      props: { open: true, families, compositions: [] },
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
    expect(rows()[0]!.text()).toContain('Latin')
    await rows()[0]!.get('[aria-label="projectConfig.fonts.moveMemberToBottom"]').trigger('click')
    expect(rows()[0]!.text()).toContain('CJK')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      key: 'body',
      name: 'Body',
      members: [{ familyKey: 'cjk' }, { familyKey: 'latin' }],
    })
  })

  it('accepts character ranges only through the advanced entry', async () => {
    const wrapper = mount(ProjectFontCompositionDialog, {
      props: {
        open: true,
        families,
        originalKey: 'body',
        compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'latin' }] }],
      },
      global: { stubs: { Teleport: true, OcAutocompletePopover: true } },
    })
    const advanced = wrapper.findAllComponents(OcButton)
      .find(button => button.text() === 'projectConfig.fonts.advancedRanges')
    await advanced!.trigger('click')
    const rangeInput = wrapper.findAll('.project-font-set-dialog__member-row input')[1]!
    await rangeInput.setValue('U+0000-007F, U+4E00-9FFF')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      originalKey: 'body',
      members: [{
        familyKey: 'latin',
        ranges: [{ start: 0, end: 127 }, { start: 0x4e00, end: 0x9fff }],
      }],
    })
  })

  it('never offers another composition as a member', async () => {
    const wrapper = mount(ProjectFontCompositionDialog, {
      props: {
        open: true,
        families,
        compositions: [
          { key: 'base', name: 'Base', members: [{ familyKey: 'latin' }] },
          { key: 'nested', name: 'Nested', members: [{ familyKey: 'cjk' }] },
        ],
      },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.get('[role="combobox"]').trigger('focus')
    expect(wrapper.text()).not.toContain('Nested')
  })

  it('supports presets and direct character input in the advanced range editor', async () => {
    const wrapper = mount(ProjectFontCompositionDialog, {
      props: {
        open: true,
        families,
        originalKey: 'body',
        compositions: [{ key: 'body', name: 'Body', members: [{ familyKey: 'latin' }] }],
      },
      global: { stubs: { Teleport: true, OcAutocompletePopover: true } },
    })
    const advanced = wrapper.findAllComponents(OcButton)
      .find(button => button.text() === 'projectConfig.fonts.advancedRanges')
    await advanced!.trigger('click')
    const latinPreset = wrapper.findAllComponents(OcButton)
      .find(candidate => candidate.text() === 'projectConfig.fonts.rangePresetLatin')
    await latinPreset!.trigger('click')
    expect((wrapper.findAll('.project-font-set-dialog__member-row input')[1]!.element as HTMLInputElement).value)
      .toBe('U+0-24F')

    await wrapper.findAll('.project-font-set-dialog__member-row input')[0]!.setValue('A中')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      members: [{
        ranges: [{ start: 65, end: 65 }, { start: 0x4e2d, end: 0x4e2d }],
      }],
    })
  })
})
