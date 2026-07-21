import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent } from '../../../shared/ui/tree/tree.types'
import WorkspaceBottomPanel from './WorkspaceBottomPanel.vue'

const problemTreeData: OcTreeData = {
  rootKeys: ['session:a'],
  items: new Map([
    ['session:a', { label: 'Card A (1)', icon: 'file.opencard' }],
    ['problem:a', { label: 'Invalid binding', icon: 'data.variable' }],
  ]),
  children: new Map([['session:a', ['problem:a']]]),
}

function mountPanel() {
  return mount(WorkspaceBottomPanel, {
    props: {
      expanded: true,
      activeTab: 'problems',
      problemCount: 1,
      problemTreeData,
      expandedProblemKeys: ['session:a'],
      outputLines: [],
      problemsLabel: 'Problems',
      outputLabel: 'Output',
      problemEmptyLabel: 'No problems',
      outputEmptyLabel: 'No output',
      expandLabel: 'Expand panel',
      collapseLabel: 'Collapse panel',
    },
  })
}

describe('WorkspaceBottomPanel', () => {
  it('projects controlled tree data and forwards its intent unchanged', () => {
    const wrapper = mountPanel()
    const tree = wrapper.getComponent(OcTree)
    const intent: OcTreeIntent = {
      type: 'node.activate',
      key: 'problem:a',
    }

    expect(tree.props('data')).toEqual(problemTreeData)
    expect(tree.props('expandedKeys')).toEqual(['session:a'])
    tree.vm.$emit('intent', intent)

    expect(wrapper.emitted('problem-tree-intent')).toEqual([[intent]])
  })

  it('emits controlled toggle and tab changes without changing its own state', async () => {
    const wrapper = mountPanel()

    await wrapper.get('.workspace-bottom-panel__toggle').trigger('click')
    await wrapper.get('#workspace-bottom-tab-output').trigger('click')

    expect(wrapper.emitted('toggle')).toHaveLength(1)
    expect(wrapper.emitted('tab-change')).toEqual([['output']])
    expect(wrapper.get('.workspace-bottom-panel').classes()).toContain('is-expanded')
    expect(wrapper.get('#workspace-bottom-tab-problems').attributes('aria-selected')).toBe('true')
  })
})
