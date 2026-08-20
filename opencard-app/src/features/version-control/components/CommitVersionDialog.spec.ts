import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import CommitVersionDialog from './CommitVersionDialog.vue'

function mountDialog(props: { busy?: boolean; error?: string } = {}) {
  return mount(CommitVersionDialog, {
    props: { open: true, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { Teleport: true },
    },
  })
}

describe('CommitVersionDialog', () => {
  it('submits a required summary and optional description', async () => {
    const wrapper = mountDialog()
    await wrapper.get('input').setValue('  Update card layout  ')
    await wrapper.get('textarea').setValue('  Align the back face with the front.  ')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([[{
      summary: 'Update card layout',
      description: 'Align the back face with the front.',
    }]])
  })

  it('does not submit without a summary', async () => {
    const wrapper = mountDialog()
    await wrapper.get('textarea').setValue('Description only')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('[role="alert"]').text()).toBe('Enter a summary.')
  })

  it('keeps dismissal and duplicate submit disabled while committing', async () => {
    const wrapper = mountDialog({ busy: true })
    await wrapper.get('input').setValue('Update card layout')
    await wrapper.get('form').trigger('submit')
    await wrapper.findAll('button').find(button => button.text() === 'Cancel')!.trigger('click')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
  })

  it('shows a commit service error without replacing the form', () => {
    const wrapper = mountDialog({ error: 'There are no staged changes to commit' })

    expect(wrapper.get('[role="alert"]').text()).toContain('There are no staged changes')
    expect(wrapper.find('input').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(true)
  })
})
