import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import enUS from '../../../locales/en-US'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import ProjectVersionList from './ProjectVersionList.vue'

function mountList() {
  return mount(ProjectVersionList, {
    props: {
      versions: [{
        commitId: 'commit-2', parentCommitId: 'commit-1', previousVersion: '0.0.1', version: '0.0.2',
        kind: 'saved', description: 'Second line\nDetails', savedAtUnixMs: Date.now(), restoredFrom: null,
        release: null, changes: { added: 0, modified: 1, deleted: 0 },
      }, {
        commitId: 'commit-1', parentCommitId: null, previousVersion: null, version: '0.0.1',
        kind: 'saved', description: 'Initial', savedAtUnixMs: Date.now() - 1000, restoredFrom: null,
        release: { publishedAtUnixMs: Date.now() - 500, description: 'Release' },
        changes: { added: 1, modified: 0, deleted: 0 },
      }],
      currentCommitId: 'commit-2',
      selectedKeys: [],
      nextCursor: 'cursor-1',
      locale: 'en-US',
      emptyLabel: 'Empty',
      busy: false,
      error: null,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
    },
  })
}

describe('ProjectVersionList', () => {
  it('uses the version tree contract and emits activation/load-more intents', async () => {
    const wrapper = mountList()
    const data = wrapper.getComponent(OcTree).props('data') as OcTreeData
    expect(data.rootKeys).toEqual(['version:commit-2', 'version:commit-1'])
    expect(data.items.get('version:commit-2')).toMatchObject({
      label: 'v0.0.2',
      description: 'Second line',
      icon: 'data.version',
      iconTone: 'primary',
    })
    expect(data.items.get('version:commit-1')?.iconTone).toBe('success')

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'node.activate',
      key: 'version:commit-2',
    })
    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('activate')).toEqual([['commit-2']])
    expect(wrapper.emitted('load-more')).toHaveLength(1)
  })
})
