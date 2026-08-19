import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcTree from '../../../components/standard/OcTree.vue'
import type { OcTreeData, OcTreeIntent } from '../../../shared/ui/tree/tree.types'
import type { AppConsoleEntry } from '../../logging/appConsole'
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

const outputEntries: AppConsoleEntry[] = [
  { id: 1, severity: 'debug', timestamp: 1_000, message: 'debug message' },
  { id: 2, severity: 'warn', timestamp: 2_000, message: 'warning message' },
  { id: 3, severity: 'error', timestamp: 3_000, message: 'error details', errorCode: 'OC-E2003' },
]

function mountPanel(
  expanded = true,
  output: readonly AppConsoleEntry[] = [],
  activeTab: 'issues' | 'output' = 'issues',
) {
  return mount(WorkspaceBottomPanel, {
    props: {
      expanded,
      activeTab,
      issueCount: 1,
      issueSeverity: 'warning',
      issueTreeData,
      issueNavigationTargets,
      expandedIssueKeys: ['session:a'],
      outputEntries: output,
      issuesLabel: 'Problems',
      outputLabel: 'Output',
      issueEmptyLabel: 'No problems',
      issueFilterLabel: 'Filter problems',
      outputEmptyLabel: 'No output',
      outputFilterEmptyLabel: 'No matching output',
      outputClearLabel: 'Clear',
      outputCopyLabel: 'Click to copy',
      outputLocale: 'en-US',
      outputSeverityFilterLabel: 'Severity filters',
      outputSeverityLabels: {
        debug: 'Debug', log: 'Log', info: 'Info', warn: 'Warning', error: 'Error',
      },
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

  it('filters diagnostics by their instance, Block, or field label text', async () => {
    const wrapper = mountPanel()
    const filter = wrapper.get('input[type="search"]')
    await filter.setValue('invalid binding')
    expect(wrapper.findComponent(OcTree).props('data').rootKeys).toEqual(['session:a'])
    await filter.setValue('missing field')
    await flushPromises()
    expect(wrapper.findComponent(OcTree).exists()).toBe(false)
    expect(wrapper.text()).toContain('No problems')
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

  it('moves focus to the toggle before making the panel content inert', async () => {
    const wrapper = mountPanel(true)
    document.body.appendChild(wrapper.element)

    try {
      const activeTab = wrapper.get('#workspace-bottom-tab-issues')
      const toggle = wrapper.get('.workspace-bottom-panel__toggle')

      ;(activeTab.element as HTMLButtonElement).focus()
      expect(document.activeElement).toBe(activeTab.element)

      await wrapper.setProps({ expanded: false })

      expect(document.activeElement).toBe(toggle.element)
      expect(wrapper.get('.workspace-bottom-panel__content').attributes()).not.toHaveProperty('aria-hidden')
      expect(wrapper.get('.workspace-bottom-panel__content').attributes()).toHaveProperty('inert')
    } finally {
      wrapper.unmount()
    }
  })

  it('exposes the highest issue severity on the center control only when issues exist', async () => {
    const wrapper = mountPanel(false)
    const toggle = wrapper.get('.workspace-bottom-panel__toggle')

    expect(toggle.attributes('data-issue-severity')).toBe('warning')

    await wrapper.setProps({ issueSeverity: 'error' })
    expect(toggle.attributes('data-issue-severity')).toBe('error')

    await wrapper.setProps({ issueCount: 0 })
    expect(toggle.attributes()).not.toHaveProperty('data-issue-severity')
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

  it('renders timestamped output, filters by severity, and emits clear', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mountPanel(true, outputEntries, 'output')

    expect(wrapper.findAll('.workspace-bottom-panel__output-line')).toHaveLength(3)
    expect(wrapper.get('.workspace-bottom-panel__output').element.lastElementChild)
      .toBe(wrapper.get('.workspace-bottom-panel__output-toolbar').element)
    expect(wrapper.get('.workspace-bottom-panel__severity-dock')
      .find('.workspace-bottom-panel__severity-filters').exists()).toBe(true)
    expect(wrapper.get('[data-severity="warn"] .workspace-bottom-panel__output-message').text())
      .toBe('warning message')
    const errorEntry = wrapper.get('.workspace-bottom-panel__output-line[data-severity="error"]')
    expect(errorEntry.text()).toContain('OC-E2003')
    expect(errorEntry.text()).toContain('Could not open the file')
    expect(errorEntry.text()).not.toContain('error details')
    await errorEntry.trigger('click')
    expect(writeText).toHaveBeenCalledWith(
      'OC-E2003 Could not open the file\nerror details',
    )
    expect(wrapper.get('.workspace-bottom-panel__severity-filter[data-severity="warn"]')
      .text()).toContain('1')

    await wrapper.get('.workspace-bottom-panel__severity-filter[data-severity="warn"]').trigger('click')
    expect(wrapper.findAll('.workspace-bottom-panel__output-line')).toHaveLength(2)
    expect(wrapper.find('.workspace-bottom-panel__output-line[data-severity="warn"]').exists()).toBe(false)

    const clear = wrapper.findAll('button').find(button => button.text() === 'Clear')!
    expect(clear.classes()).toContain('workspace-bottom-panel__output-clear')
    await clear.trigger('click')
    expect(wrapper.emitted('output-clear')).toEqual([[]])
  })

  it('follows new output only while the log view is at the end', async () => {
    const wrapper = mountPanel(true, outputEntries, 'output')
    const scroll = wrapper.get<HTMLElement>('.workspace-bottom-panel__output-scroll')
    Object.defineProperties(scroll.element, {
      scrollHeight: { configurable: true, value: 300 },
      clientHeight: { configurable: true, value: 100 },
    })

    await wrapper.setProps({ outputEntries: [...outputEntries, {
      id: 4, severity: 'log', timestamp: 4_000, message: 'new message',
    }] })
    await flushPromises()
    expect(scroll.element.scrollTop).toBe(300)

    scroll.element.scrollTop = 50
    await scroll.trigger('scroll')
    await wrapper.setProps({ outputEntries: [...outputEntries, {
      id: 5, severity: 'log', timestamp: 5_000, message: 'later message',
    }] })
    await flushPromises()
    expect(scroll.element.scrollTop).toBe(50)
  })
})
