import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NodeTree from './NodeTree.vue'
import type { ActionDefinition, ITreeNode } from '../../shared/ui/tree/tree.types'

const renameAction: ActionDefinition = {
  key: 'rename',
  icon: 'codicon-edit',
  title: 'Rename',
}

describe('NodeTree', () => {
  it('keeps root keyboard toggle scoped to the root row itself', async () => {
    const wrapper = mount(NodeTree, {
      props: {
        title: 'Explorer',
        nodes: [],
        actionKeys: [renameAction.key],
        actions: new Map([[renameAction.key, renameAction]]),
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    })

    const rootActionButton = wrapper.get('.root-actions .action-trigger')
    await rootActionButton.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:expanded')).toBeUndefined()

    const rootRow = wrapper.get('.root-content')
    await rootRow.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:expanded')).toEqual([[true]])
  })

  it('keeps node keyboard selection scoped to the treeitem itself', async () => {
    const node: ITreeNode = {
      key: 'node-1',
      name: 'Node 1',
      actionKeys: [renameAction.key],
    }

    const wrapper = mount(NodeTree, {
      props: {
        title: 'Explorer',
        expanded: true,
        nodes: [node],
        actions: new Map([[renameAction.key, renameAction]]),
      },
      global: {
        stubs: {
          AppIcon: true,
        },
      },
    })

    const nodeActionButton = wrapper.get('.tree-children .action-trigger')
    await nodeActionButton.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:selectedKeys')).toBeUndefined()

    const nodeRow = wrapper.get('[data-tree-node-key="node-1"]')
    await nodeRow.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:selectedKeys')).toEqual([[['node-1']]])
  })
})
