import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ProjectFontRegistryEditor from './ProjectFontRegistryEditor.vue'

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))

describe('ProjectFontRegistryEditor', () => {
  it('shows one file per project font and exposes configuration', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, {
      props: {
        fonts: {
          'brand-sans': {
            name: 'Brand Sans',
            source: 'assets/fonts/BrandSans.woff2',
          },
        },
        loadErrors: [{
          fontId: 'brand-sans',
          source: 'assets/fonts/BrandSans.woff2',
          message: 'Invalid font data',
        }],
      },
    })

    expect(wrapper.text()).toContain('Brand Sans')
    expect(wrapper.text()).toContain('font:brand-sans')
    expect(wrapper.get('input').element.value).toBe('assets/fonts/BrandSans.woff2')
    expect(wrapper.get('[data-tooltip="projectConfig.fonts.loadFailed"]').attributes('aria-label'))
      .toBe('projectConfig.fonts.loadFailed')
    await wrapper.get('[aria-label="projectConfig.fonts.configure"]').trigger('click')
    expect(wrapper.emitted('configure-font')).toEqual([['brand-sans']])
  })

  it('registers and removes complete project-font records', async () => {
    const wrapper = mount(ProjectFontRegistryEditor, {
      props: {
        fonts: {
          brand: { name: 'Brand', source: 'assets/fonts/Brand.woff2' },
        },
      },
    })

    await wrapper.get('.project-font-registry__header button').trigger('click')
    expect(wrapper.emitted('register-font')).toHaveLength(1)

    await wrapper.get('[aria-label="projectConfig.fonts.remove"]').trigger('click')
    expect(wrapper.emitted('update:fonts')?.[0]?.[0]).toEqual({})
  })
})
