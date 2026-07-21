import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent } from '../../../shared/ui/tree/tree.types'
import WorkspaceBottomPanel from './WorkspaceBottomPanel.vue'

const issueTreeData: OcTreeData = {
  rootKeys: ['session:a'],
  items: new Map([
    ['session:a', { label: 'Card A (1)', icon: 'file.opencard' }],
    ['issue:a', { label: 'Invalid binding', icon: 'status.warning' }],
  ]),
  children: new Map([['session:a', ['issue:a']]]),
}

const navigationToken = { protocol: 'card-designer', version: 1 } as const
const issueNavigationTargets = new Map([
  ['issue:a', { sessionId: 'a', token: navigationToken }],
])

function mountPanel() {
  return mount(WorkspaceBottomPanel, {
    props: {
      expanded: true,
      activeTab: 'issues',
      issueCount: 1,
      issueTreeData,
      issueNavigationTargets,
      expandedIssueKeys: ['session:a'],
      outputLines: [],
      issuesLabel: 'Problems',
      outputLabel: 'Output',
      issueEmptyLabel: 'No problems',
      outputEmptyLabel: 'No output',
      expandLabel: 'Expand panel',
      collapseLabel: 'Collapse panel',
    },
  })
}

describe('WorkspaceBottomPanel', () => {
  it('projects controlled tree data and emits navigation only for an issue leaf', () => {
    const wrapper = mountPanel()
    const tree = wrapper.getComponent(OcTree)
    const intent: OcTreeIntent = {
      type: 'node.activate',
      key: 'issue:a',
    }

    expect(tree.props('data')).toEqual(issueTreeData)
    expect(tree.props('expandedKeys')).toEqual(['session:a'])
    tree.vm.$emit('intent', intent)

    expect(wrapper.emitted('issue-navigate')).toEqual([[
      { sessionId: 'a', token: navigationToken },
    ]])
  })

  it('emits controlled expansion changes without interpreting the node key', () => {
    const wrapper = mountPanel()
    const tree = wrapper.getComponent(OcTree)

    tree.vm.$emit('intent', {
      type: 'expansion.change',
      key: 'session:a',
      expanded: false,
    } satisfies OcTreeIntent)

    expect(wrapper.emitted('issue-expansion-change')).toEqual([['session:a', false]])
  })

  it('does not navigate for a grouping node without a supplied target', () => {
    const wrapper = mountPanel()
    const tree = wrapper.getComponent(OcTree)

    tree.vm.$emit('intent', {
      type: 'node.activate',
      key: 'session:a',
    } satisfies OcTreeIntent)

    expect(wrapper.emitted('issue-navigate')).toBeUndefined()
  })

  it('emits controlled toggle and tab changes without changing its own state', async () => {
    const wrapper = mountPanel()

    await wrapper.get('.workspace-bottom-panel__toggle').trigger('click')
    await wrapper.get('#workspace-bottom-tab-output').trigger('click')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.emitted('tab-change')).toEqual([['output']])
    expect(wrapper.get('.workspace-bottom-panel').classes()).toContain('is-expanded')
    expect(wrapper.get('#workspace-bottom-tab-issues').attributes('aria-selected')).toBe('true')
  })
})
