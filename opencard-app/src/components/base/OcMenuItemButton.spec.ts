import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcMenuItemButton from './OcMenuItemButton.vue'

describe('OcMenuItemButton', () => {
  it('renders label and icon placeholder by default', () => {
    const wrapper = mount(OcMenuItemButton, {
      props: { label: 'Open Project' },
    })

    expect(wrapper.text()).toContain('Open Project')
    expect(wrapper.find('.oc-menu-item-button__icon-placeholder').exists()).toBe(true)
  })

  it('emits click when enabled and maps disabled to underlying pressable', async () => {
    const enabled = mount(OcMenuItemButton, {
      props: { label: 'Export', icon: 'codicon-export' },
    })
    await enabled.get('button').trigger('click')
    expect(enabled.emitted('click')).toHaveLength(1)

    const disabled = mount(OcMenuItemButton, {
      props: { label: 'Disabled', disabled: true },
    })
    expect(disabled.get('button').attributes('disabled')).toBeDefined()
  })
})
