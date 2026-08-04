import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import FeedbackDialog from './FeedbackDialog.vue'

function mountDialog(props: InstanceType<typeof FeedbackDialog>['$props']) {
  return mount(FeedbackDialog, {
    props,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { Teleport: true },
    },
  })
}

describe('FeedbackDialog', () => {
  it('switches to feedback history through the shared centered page control', async () => {
    const wrapper = mountDialog({ open: true, activePage: 'submit' })
    await wrapper.findAll('button').find(button => button.text().includes('My Feedback'))!.trigger('click')
    expect(wrapper.emitted('pageChange')).toEqual([['history']])
  })

  it('switches between the suggestion and problem forms', async () => {
    const wrapper = mountDialog({ open: true, initialKind: 'suggestion' })
    expect(wrapper.text()).toContain('How would you improve OpenCard?')
    expect(wrapper.text()).not.toContain('How can we reproduce it?')

    await wrapper.findAll('.feedback-dialog__kind button')[0]!.trigger('click')
    expect(wrapper.text()).toContain('What happened?')
    expect(wrapper.text()).toContain('How can we reproduce it?')
  })

  it('shows sanitized diagnostics only after explicit opt-in', async () => {
    const wrapper = mountDialog({
      open: true,
      initialKind: 'bug',
      diagnostics: { errorMessage: 'Failed at C:\\Users\\Alice\\secret.ocdocument' },
    })
    expect(wrapper.find('.feedback-dialog__diagnostics').exists()).toBe(false)

    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.get('.feedback-dialog__diagnostics').text()).toContain('<local-path>')
    expect(wrapper.get('.feedback-dialog__diagnostics').text()).not.toContain('Alice')
  })

  it('makes an unconfigured service explicit and keeps submission disabled', () => {
    const wrapper = mountDialog({ open: true })
    expect(wrapper.text()).toContain('Feedback service is not configured')
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
