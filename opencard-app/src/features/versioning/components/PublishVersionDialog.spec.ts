import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import PublishVersionDialog from './PublishVersionDialog.vue'

afterEach(() => { document.body.innerHTML = '' })

describe('PublishVersionDialog', () => {
  it('defaults to the save description and permits renumbering only when requested', async () => {
    const wrapper = mount(PublishVersionDialog, {
      attachTo: document.body,
      props: {
        version: {
          commitId: 'commit-1', parentCommitId: null, previousVersion: null, version: '0.0.1', kind: 'saved',
          description: 'First release', savedAtUnixMs: 1, restoredFrom: null, release: null,
          changes: { added: 1, modified: 0, deleted: 0 },
        },
        allowRenumber: true,
        editMode: false,
        busy: false,
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
        stubs: { transition: false },
      },
    })
    await wrapper.vm.$nextTick()
    const inputs = Array.from(document.body.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea'))
    expect(inputs.map(input => input.value)).toEqual(['0.0.1', 'First release'])

    document.body.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
    expect(wrapper.emitted('submit')).toEqual([['0.0.1', 'First release']])
  })
})
