import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import enUS from '../../../locales/en-US'
import type { OcTreeData } from '../../../shared/ui/tree/tree.types'
import ChangeHistoryList from './ChangeHistoryList.vue'

const savedAt = new Date('2026-08-10T08:00:00Z').getTime()

function mountList(overrides: Record<string, unknown> = {}) {
  return mount(ChangeHistoryList, {
    props: {
      versions: [{
        commitId: 'commit-1',
        parentCommitId: null,
        version: '0.0.1',
        kind: 'saved',
        description: 'Initial card',
        savedAtUnixMs: savedAt,
        restoredFrom: null,
        release: null,
        changes: { added: 1, modified: 0, deleted: 0 },
      }],
      localHistory: [{
        schemaVersion: 1,
        entryId: 'local-1',
        relativePath: 'cards/main.ocdocument',
        createdAtUnixMs: savedAt + 60_000,
        source: 'manual-save',
        sourceDescription: null,
        contentOid: 'oid-1',
        size: 12,
      }],
      emptyLabel: 'No history',
      locale: 'en-US',
      sourceFilter: 'all',
      activeCompareKey: null,
      ...overrides,
    },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
    },
  })
}

function treeData(wrapper: ReturnType<typeof mountList>): OcTreeData {
  return wrapper.getComponent(OcTree).props('data') as OcTreeData
}

describe('ChangeHistoryList', () => {
  it('shows both sources in stable newest-first order and activates either source', async () => {
    const wrapper = mountList()

    expect(treeData(wrapper).rootKeys).toEqual([
      'local-history:local-1',
      'version:commit-1',
    ])

    await wrapper.get('[data-oc-tree-key="version:commit-1"] .oc-tree__row').trigger('click')
    await wrapper.get('[data-oc-tree-key="local-history:local-1"] .oc-tree__row').trigger('click')

    expect(wrapper.emitted('select')).toEqual([
      ['version', 'commit-1'],
      ['local-history', 'local-1'],
    ])
  })

  it('filters the unified history without changing source data', () => {
    const versionsOnly = mountList({ sourceFilter: 'version' })
    const localHistoryOnly = mountList({ sourceFilter: 'local-history' })

    expect(treeData(versionsOnly).rootKeys).toEqual(['version:commit-1'])
    expect(treeData(localHistoryOnly).rootKeys).toEqual(['local-history:local-1'])
  })

  it('uses source-specific context actions and no inline row actions', () => {
    const wrapper = mountList()
    const data = treeData(wrapper)
    const version = data.items.get('version:commit-1')
    const local = data.items.get('local-history:local-1')

    expect(version?.actions).toBeUndefined()
    expect(version?.contextActions).toEqual(['history.compare', 'history.info'])
    expect(local?.actions).toBeUndefined()
    expect(local?.contextActions).toEqual([
      'history.compare',
      'history.restore',
      'history.delete',
    ])
  })

  it('emits context intents and only disables deletion for the open comparison', async () => {
    const wrapper = mountList({ activeCompareKey: 'local-history:local-1' })
    const data = treeData(wrapper)
    const local = data.items.get('local-history:local-1')

    expect(local?.disabledActions?.has('history.restore')).toBe(false)
    expect(local?.disabledActions?.has('history.delete')).toBe(true)

    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', {
      type: 'action.invoke',
      key: 'version:commit-1',
      actionKey: 'history.info',
      source: 'context',
    })
    tree.vm.$emit('intent', {
      type: 'action.invoke',
      key: 'local-history:local-1',
      actionKey: 'history.restore',
      source: 'context',
    })
    tree.vm.$emit('intent', {
      type: 'action.invoke',
      key: 'local-history:local-1',
      actionKey: 'history.delete',
      source: 'context',
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('info')).toEqual([['commit-1']])
    expect(wrapper.emitted('restore')).toEqual([['local-1']])
    expect(wrapper.emitted('delete')).toEqual([['local-1']])
  })
})
