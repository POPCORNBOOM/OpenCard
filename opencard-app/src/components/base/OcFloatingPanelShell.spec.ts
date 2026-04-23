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
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--width-auto')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--height-auto')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--inset-none')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--pointer-auto')
  })

  it('supports semantic spacing and dimension variants', () => {
    const wrapper = mount(OcFloatingPanelShell, {
      props: {
        blurred: false,
        padding: 'md',
        width: 'panel',
        height: 'full',
        inset: 'overlay',
        pointer: 'none',
      },
      slots: {
        default: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).not.toContain('is-blurred')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--padding-md')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--width-panel')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--height-full')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--inset-overlay')
    expect(wrapper.classes()).toContain('oc-floating-panel-shell--pointer-none')
  })
})
