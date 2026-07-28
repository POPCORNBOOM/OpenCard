import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProjectFontRegistryEditor', () => {
  it('shows stable references and emits visual family edits', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, {
      props: {
        fonts: {
          'brand-sans': {
            family: 'Brand Sans',
            faces: [{ source: 'assets/fonts/BrandSans.woff2', weight: '400', style: 'normal' }],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('project:brand-sans')
    await wrapper.get('.project-font-registry__family input').setValue('Brand Display')

    expect(wrapper.emitted('update:fonts')?.[0]?.[0]).toMatchObject({
      'brand-sans': { family: 'Brand Display' },
    })
  })

  it('exposes import commands for new fonts and additional faces', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, {
      props: {
        fonts: {
          brand: {
            family: 'Brand',
            faces: [{ source: 'assets/fonts/Brand.woff2' }],
          },
        },
      },
    })

    await wrapper.get('.project-font-registry__header button').trigger('click')
    await wrapper.get('[aria-label="projectConfig.fonts.addFace"]').trigger('click')

    expect(wrapper.emitted('import-font')).toHaveLength(1)
    expect(wrapper.emitted('import-face')).toEqual([['brand']])
  })
})
