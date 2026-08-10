import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import SaveVersionDialog from './SaveVersionDialog.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SaveVersionDialog', () => {
  it('shows the proposed version and submits the required description', async () => {
    const wrapper = mount(SaveVersionDialog, {
      attachTo: document.body,
      props: {
        busy: false,
        confirmation: {
          projectRoot: 'D:/project',
          projectId: 'project-id',
          generation: 1,
          version: '0.0.1',
          expectedHeadCommitId: null,
          expectedSnapshotId: 'snapshot-1',
          changeSummary: {
            added: 1,
            modified: 0,
            deleted: 0,
            files: [{ path: 'cards/main.ocdocument', status: 'added' }],
            snapshotId: 'snapshot-1',
          },
          sessionRevisions: [],
        },
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
        stubs: { transition: false },
      },
    })
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('v0.0.1')
    expect(document.body.textContent).not.toContain('cards/main.ocdocument')
    const description = document.body.querySelector<HTMLTextAreaElement>('textarea')!
    expect(description.value).toBe('Update card package')
    document.body.querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))

    expect(wrapper.emitted('submit')).toEqual([['Update card package']])
  })

  it('shows the editable release version in save-and-publish mode', async () => {
    const wrapper = mount(SaveVersionDialog, {
      attachTo: document.body,
      props: {
        busy: false,
        confirmation: {
          projectRoot: 'D:/project', projectId: 'project-id', generation: 1,
          version: '0.0.2', expectedHeadCommitId: null, expectedSnapshotId: 'snapshot-1',
          publish: true,
          changeSummary: {
            added: 1, modified: 0, deleted: 0,
            files: [{ path: 'cards/main.ocdocument', status: 'added' }], snapshotId: 'snapshot-1',
          },
          sessionRevisions: [],
        },
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
        stubs: { transition: false },
      },
    })
    await wrapper.vm.$nextTick()

    const inputs = [...document.body.querySelectorAll<HTMLInputElement>('input')]
    expect(document.body.textContent).toContain('Save and Publish')
    expect(inputs.some(input => input.value === '0.0.2')).toBe(true)
  })
})
