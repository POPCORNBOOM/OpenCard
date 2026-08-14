import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import ReleaseNotesDialog from './ReleaseNotesDialog.vue'

function mountDialog(available: boolean, downloaded = false) {
  return mount(ReleaseNotesDialog, {
    props: {
      open: true,
      release: {
        version: '0.3.0',
        body: '# Improvements\n\n- Faster projects',
        publishedAt: null,
      },
      available,
      busy: false,
      downloaded,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { Teleport: true },
    },
  })
}

describe('ReleaseNotesDialog', () => {
  it('renders Markdown and offers download for an available release', async () => {
    const wrapper = mountDialog(true)

    expect(wrapper.get('.release-notes-dialog__body h1').text()).toBe('Improvements')
    expect(wrapper.text()).toContain('Download 0.3.0')

    const buttons = wrapper.findAll('button')
    await buttons[buttons.length - 1]!.trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })

  it('changes the available release action to install after download', () => {
    const wrapper = mountDialog(true, true)

    expect(wrapper.text()).toContain('Install 0.3.0')
  })

  it('shows current release notes without an install action', () => {
    const wrapper = mountDialog(false)

    expect(wrapper.text()).toContain("What's new in OpenCard 0.3.0")
    expect(wrapper.text()).not.toContain('Current release notes')
    expect(wrapper.text()).not.toContain('Install 0.3.0')
  })
})
