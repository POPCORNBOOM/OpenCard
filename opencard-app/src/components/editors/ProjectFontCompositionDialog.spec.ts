import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontCompositionDialog from './ProjectFontCompositionDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const fonts = [
  { key: 'latin', name: 'Latin', files: { normal: { upright: 'fonts/Latin.woff2' } } },
  { key: 'cjk', name: 'CJK', files: { normal: { upright: 'fonts/CJK.woff2' } } },
]

describe('ProjectFontCompositionDialog', () => {
  it('stores ordered fontKey members', async () => {
    const wrapper = mount(ProjectFontCompositionDialog, { props: { open: true, families: fonts, compositions: [] }, global: { stubs: { Teleport: true, OcAutocompletePopover: true } } })
    await wrapper.get('.project-font-set-dialog__field input').setValue('Body')
    const input = wrapper.get('[role="combobox"]')
    await input.setValue('CJK'); await input.trigger('keydown', { key: 'Enter' })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ members: [{ fontKey: 'cjk' }] })
  })

  it('does not offer composition members', async () => {
    const wrapper = mount(ProjectFontCompositionDialog, { props: {
      open: true, families: fonts, compositions: [{ key: 'nested', name: 'Nested', members: [{ fontKey: 'latin' }] }],
    }, global: { stubs: { Teleport: true, OcAutocompletePopover: true } } })
    await wrapper.get('[role="combobox"]').trigger('focus')
    expect(wrapper.text()).not.toContain('Nested')
  })
})
