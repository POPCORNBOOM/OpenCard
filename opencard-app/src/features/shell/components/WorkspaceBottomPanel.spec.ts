import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcIcon from '../../../components/base/OcIcon.vue'
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

function mountPanel(expanded = true) {
  return mount(WorkspaceBottomPanel, {
    props: {
      expanded,
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
      pinLabel: 'Pin panel',
      unpinLabel: 'Unpin panel',
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

  it('requests expansion on hover and collapse after leaving the whole panel', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel(false)

    try {
      await wrapper.get('.workspace-bottom-panel__toggle').trigger('mouseenter')
      await wrapper.setProps({ expanded: true })
      await wrapper.get('#workspace-bottom-tab-output').trigger('click')
      await wrapper.get('.workspace-bottom-panel').trigger('mouseleave')
      expect(wrapper.emitted('expanded-change')).toEqual([[true]])
      vi.advanceTimersByTime(180)

      expect(wrapper.emitted('expanded-change')).toEqual([[true], [false]])
      expect(wrapper.emitted('tab-change')).toEqual([['output']])
      expect(wrapper.get('.workspace-bottom-panel').classes()).toContain('is-expanded')
      expect(wrapper.get('#workspace-bottom-tab-issues').attributes('aria-selected')).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('toggles expansion from the center control', async () => {
    const wrapper = mountPanel(true)

    await wrapper.get('.workspace-bottom-panel__toggle').trigger('click')
    await wrapper.setProps({ expanded: false })
    await wrapper.get('.workspace-bottom-panel__toggle').trigger('click')

    expect(wrapper.emitted('expanded-change')).toEqual([[false], [true]])
  })

  it('disables automatic expansion and collapse while pinned', async () => {
    vi.useFakeTimers()
    const wrapper = mountPanel(true)

    try {
      const pin = wrapper.get('.workspace-bottom-panel__pin')
      expect(pin.getComponent(OcIcon).props('name')).toBe('tool.pin-off')
      await pin.trigger('click')
      expect(pin.attributes('aria-pressed')).toBe('true')
      expect(pin.getComponent(OcIcon).props('name')).toBe('tool.pin')

      await wrapper.get('.workspace-bottom-panel').trigger('mouseleave')
      vi.advanceTimersByTime(180)
      expect(wrapper.emitted('expanded-change')).toBeUndefined()

      await wrapper.get('.workspace-bottom-panel__toggle').trigger('click')
      await wrapper.setProps({ expanded: false })
      await wrapper.get('.workspace-bottom-panel__toggle').trigger('mouseenter')

      expect(wrapper.emitted('expanded-change')).toEqual([[false]])
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not expand when the pointer only crosses the panel edge', async () => {
    const wrapper = mountPanel(false)

    await wrapper.get('.workspace-bottom-panel').trigger('mouseenter')

    expect(wrapper.emitted('expanded-change')).toBeUndefined()
  })

  it('opens on keyboard focus and closes when focus leaves the panel', () => {
    const wrapper = mountPanel(false)
    const panel = wrapper.get('.workspace-bottom-panel')
    panel.element.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    panel.element.dispatchEvent(new FocusEvent('focusout', {
      bubbles: true,
      relatedTarget: document.body,
    }))

    expect(wrapper.emitted('expanded-change')).toEqual([[true], [false]])
  })
})
