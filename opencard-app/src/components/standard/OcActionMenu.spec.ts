import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcActionMenu from './OcActionMenu.vue'

describe('OcActionMenu', () => {
  it('renders dividers without turning them into commands', async () => {
    const wrapper = mount(OcActionMenu, {
      props: {
        actions: [
          { key: 'save', title: 'Save', icon: 'action.save', shortcut: ['Ctrl', 'S'] },
          { type: 'divider', key: 'file-export-divider' },
          { key: 'export', title: 'Export', icon: 'action.export' },
        ],
      },
    })

    expect(wrapper.findAll('[role="separator"]')).toHaveLength(1)
    expect(wrapper.findAll('[role="menuitem"]')).toHaveLength(2)
    expect(wrapper.findAll('[role="menuitem"]')[0]!.attributes('data-tooltip')).toBe('Save')
    expect(wrapper.findAll('[role="menuitem"]')[0]!.attributes('title')).toBeUndefined()
    expect(wrapper.findAll('.oc-action-menu__shortcut-chip').map(chip => chip.text()))
      .toEqual(['Ctrl', 'S'])

    await wrapper.findAll('[role="menuitem"]')[1]!.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[{ key: 'export' }]])
  })
})
