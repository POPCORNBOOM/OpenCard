import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistrationDialog from './ProjectFontRegistrationDialog.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
const baseProps = {
  open: true,
  selectFilesOnOpen: false,
  getManagedFontSource: () => 'fonts/Regular.ttf',
  resolveImportConflict: async () => null,
}
const mountDialog = (overrides: Record<string, unknown> = {}) => mount(ProjectFontRegistrationDialog, {
  props: { ...baseProps, ...overrides },
  global: { stubs: { Teleport: true } },
})

describe('ProjectFontRegistrationDialog', () => {
  it('persists only explicitly selected slots and supports the six-slot advanced editor', async () => {
    const wrapper = mountDialog({ originalKey: 'brand-sans', registry: {
      'brand-sans': { kind: 'family', name: 'Brand Sans', family: {
        key: 'brand-sans', name: 'Brand Sans', files: { normal: { upright: 'fonts/Regular.ttf' } },
      } },
    } })
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ families: [{ slots: { 'normal.upright': { sourcePath: 'fonts/Regular.ttf' } } }] })
    expect(wrapper.findAll('.project-font-dialog__slot-table thead th')).toHaveLength(3)
    expect(wrapper.findAll('.project-font-dialog__slot-table tbody tr')).toHaveLength(3)
    expect(wrapper.text()).toContain('projectConfig.fonts.weightLight')
  })
})
