import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import InitializeRepositoryDialog from './InitializeRepositoryDialog.vue'

function mountDialog(props: { busy?: boolean; error?: string } = {}) {
  return mount(InitializeRepositoryDialog, {
    props: { open: true, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { Teleport: true },
    },
  })
}

describe('InitializeRepositoryDialog', () => {
  it('submits the trimmed commit identity', async () => {
    const wrapper = mountDialog()
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('  Card Author  ')
    await inputs[1]!.setValue('  author@example.com  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{
      name: 'Card Author',
      email: 'author@example.com',
    }]])
  })

  it('requires both identity fields', async () => {
    const wrapper = mountDialog()
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.findAll('[role="alert"]').map(alert => alert.text())).toEqual([
      'Enter the commit author name.',
      'Enter the commit author email.',
    ])
  })

  it('blocks dismissal and duplicate submission while initializing', async () => {
    const wrapper = mountDialog({ busy: true })
    const inputs = wrapper.findAll('input')
    await inputs[0]!.setValue('Card Author')
    await inputs[1]!.setValue('author@example.com')
    await wrapper.get('form').trigger('submit')
    await wrapper.findAll('button').find(button => button.text() === 'Cancel')!.trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
  })
})
