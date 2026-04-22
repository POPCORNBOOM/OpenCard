import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcFloatingPanelShell from './OcFloatingPanelShell.vue'

describe('OcFloatingPanelShell', () => {
  it('renders default floating shell styles', () => {
    const wrapper = mount(OcFloatingPanelShell, {
      slots: {
        default: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).toContain('oc-floating-panel-shell')
    expect(wrapper.classes()).toContain('is-blurred')
    expect(wrapper.classes()).toContain('oc-surface--shadow-overlay')
  })

  it('supports opt-out blur and padding variants', () => {
    const wrapper = mount(OcFloatingPanelShell, {
      props: {
        blurred: false,
        padding: 'md',
      },
      slots: {
        default: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).not.toContain('is-blurred')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--padding-md')
  })
})
