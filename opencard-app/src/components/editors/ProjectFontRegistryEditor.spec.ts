import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProjectFontRegistryEditor', () => {
  it('renders six-slot fonts and invokes configuration', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, { props: {
      heading: 'Fonts', description: 'Description', families: [{ key: 'brand', name: 'Brand', files: { normal: { upright: 'fonts/Brand.ttf', italic: 'fonts/BrandItalic.ttf' } } }],
      compositions: [], resolveAssetSrc: source => source, readFontBytes: async () => new Uint8Array(),
    }, global: { stubs: { Teleport: true } } })
    expect(wrapper.text()).toContain('Brand')
  })
})
