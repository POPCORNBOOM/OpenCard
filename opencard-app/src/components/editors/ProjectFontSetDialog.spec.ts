import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontSetDialog from './ProjectFontSetDialog.vue'
import OcButton from '../base/OcButton.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

const fonts = [
  { key: 'latin', name: 'Latin', source: 'Latin.woff2' },
  { key: 'cjk', name: 'CJK', source: 'CJK.woff2' },
]

describe('ProjectFontSetDialog', () => {
  it('requires one member on creation and preserves selection order', async () => {
    const wrapper = mount(ProjectFontSetDialog, {
      props: { open: true, fonts, fontSets: [] },
      global: { stubs: { Teleport: true } },
    })
    expect(wrapper.findAll('input')[0]!.element.value).toBe('projectConfig.fonts.defaultSetName')
    await wrapper.findAll('input')[0]!.setValue('Body')
    const buttons = wrapper.findAllComponents(OcButton)
    const submit = buttons[buttons.length - 1]!
    expect(submit.props('disabled')).toBe(true)

    await wrapper.findAll('input[type="checkbox"]')[1]!.setValue(true)
    await wrapper.findAll('input[type="checkbox"]')[0]!.setValue(true)
    expect(submit.props('disabled')).toBe(false)
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
      global: { stubs: { Teleport: true } },
    })
    const nested = wrapper.findAll('input[type="checkbox"]').find(input => input.element.parentElement?.textContent?.includes('Nested'))
    expect(nested?.attributes()).toHaveProperty('disabled')
    await wrapper.find('input[type="checkbox"]').setValue(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ originalKey: 'base', fontKeys: [] })
  })
})
