import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import RestoreProjectDialog from './RestoreProjectDialog.vue'

function mountDialog(stage: 'changes' | 'confirm') {
  return mount(RestoreProjectDialog, {
    attachTo: document.body,
    props: {
      target: {
        commitId: 'commit-1', parentCommitId: null, previousVersion: null, version: '0.0.1', kind: 'saved',
        description: 'First', savedAtUnixMs: 1, restoredFrom: null, release: null,
        changes: { added: 1, modified: 0, deleted: 0 },
      },
      stage,
      changes: { added: 1, modified: 2, deleted: 3 },
      busy: false,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: { transition: false },
    },
  })
}

describe('RestoreProjectDialog', () => {
  it('exposes save, discard and cancel actions for current disk changes', async () => {
    const wrapper = mountDialog('changes')
    const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button'))
    buttons[1].click()
    buttons[2].click()
    buttons[0].click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('save-current')).toHaveLength(1)
    expect(wrapper.emitted('discard-current')).toHaveLength(1)
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('submits the default restore description in final confirmation', async () => {
    const wrapper = mountDialog('confirm')
    await wrapper.vm.$nextTick()
    document.body.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('submit')).toEqual([['Restore to v0.0.1']])
  })
})
