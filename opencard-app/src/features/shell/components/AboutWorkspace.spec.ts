import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import packageMetadata from '../../../../package.json'
import enUS from '../../../locales/en-US'
import AboutWorkspace from './AboutWorkspace.vue'

describe('AboutWorkspace', () => {
  it('shows OpenCard information and emits the return intent', async () => {
    const wrapper = mount(AboutWorkspace, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })

    expect(wrapper.text()).toContain('OpenCard')
    expect(wrapper.text()).toContain(packageMetadata.version)
    expect(wrapper.get('img').attributes('alt')).toBe('OpenCard')

    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })
})
