import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import VersionInfoDialog from './VersionInfoDialog.vue'

afterEach(() => { document.body.innerHTML = '' })

describe('VersionInfoDialog', () => {
  it('shows immutable version information and offers publishing once', async () => {
    const wrapper = mount(VersionInfoDialog, {
      attachTo: document.body,
      props: {
        version: {
          commitId: 'commit-1', parentCommitId: 'parent', previousVersion: '0.0.0', version: '0.0.1', kind: 'saved',
          description: 'Initial card set', savedAtUnixMs: 1, restoredFrom: null, release: null,
          changes: { added: 2, modified: 0, deleted: 0 },
        },
        currentCommitId: 'commit-1',
        busy: false,
        locale: 'en-US',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
        stubs: { transition: false },
      },
    })
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('Current · Saved')
    expect(document.body.textContent).toContain('Initial card set')
    expect(document.body.textContent).toContain('v0.0.0')

    const publish = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Publish')!
    publish.click()
    expect(wrapper.emitted('publish')).toHaveLength(1)
  })
})
