import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import packageMetadata from '../../../../package.json'
import enUS from '../../../locales/en-US'
import AboutWorkspace from './AboutWorkspace.vue'

describe('AboutWorkspace', () => {
  it('shows OpenCard information and emits footer intents', async () => {
    const wrapper = mount(AboutWorkspace, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })

    expect(wrapper.text()).toContain('OpenCard')
    expect(wrapper.text()).toContain(packageMetadata.version)
    expect(wrapper.get('img').attributes('alt')).toBe('OpenCard')

    const footerButtons = wrapper.findAll('.about-workspace__footer-actions button')
    await footerButtons.find(button => button.text().includes('Feedback and Suggestions'))!.trigger('click')
    expect(wrapper.emitted('sendFeedback')).toHaveLength(1)
    await footerButtons.find(button => button.text().includes('My Feedback'))!.trigger('click')
    expect(wrapper.emitted('viewFeedback')).toHaveLength(1)
    await footerButtons.find(button => button.text().includes('Back to workspace'))!.trigger('click')
    expect(wrapper.emitted('back')).toHaveLength(1)
  })

  it('shows cached release notes and exposes an available update beside the version', async () => {
    const wrapper = mount(AboutWorkspace, {
      props: {
        currentReleaseNotes: {
          version: packageMetadata.version,
          body: '# Improvements\n\n- Faster projects',
          publishedAt: null,
          seenAt: null,
        },
        availableUpdateVersion: '0.3.0',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })

    expect(wrapper.get('.about-workspace__release-notes h1').text()).toBe('Improvements')
    const updateButton = wrapper.get('[aria-label="Download OpenCard 0.3.0"]')
    await updateButton.trigger('click')
    expect(wrapper.emitted('showAvailableRelease')).toHaveLength(1)
  })
})
