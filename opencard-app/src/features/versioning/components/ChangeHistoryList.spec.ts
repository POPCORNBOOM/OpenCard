import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import enUS from '../../../locales/en-US'
import ChangeHistoryList from './ChangeHistoryList.vue'

describe('ChangeHistoryList', () => {
  it('merges saved versions and local history and activates either source', async () => {
    const wrapper = mount(ChangeHistoryList, {
      props: {
        versions: [{
          commitId: 'commit-1',
          parentCommitId: null,
          version: '0.0.1',
          kind: 'saved',
          description: 'Initial card',
          savedAtUnixMs: Date.now() - 60_000,
          restoredFrom: null,
          release: null,
          changes: { added: 1, modified: 0, deleted: 0 },
        }],
        localHistory: [{
          schemaVersion: 1,
          entryId: 'local-1',
          relativePath: 'cards/main.ocdocument',
          createdAtUnixMs: Date.now(),
          source: 'manual-save',
          sourceDescription: null,
          contentOid: 'oid-1',
          size: 12,
        }],
        emptyLabel: 'No history',
        locale: 'en-US',
      },
      global: {
        plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      },
    })

    expect(wrapper.text()).toContain('v0.0.1')
    expect(wrapper.text()).toContain('Manual save')

    await wrapper.get('[data-oc-tree-key="version:commit-1"] .oc-tree__row').trigger('click')
    await wrapper.get('[data-oc-tree-key="local-history:local-1"] .oc-tree__row').trigger('click')

    expect(wrapper.emitted('select')).toEqual([
      ['version', 'commit-1'],
      ['local-history', 'local-1'],
    ])
  })
})
