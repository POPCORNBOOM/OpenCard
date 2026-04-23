import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcPanelSection from './OcPanelSection.vue'

describe('OcPanelSection', () => {
  it('renders header when title is provided', () => {
    const wrapper = mount(OcPanelSection, {
      props: {
        title: 'Inspector',
      },
      slots: {
        default: '<div>body</div>',
      },
    })

    expect(wrapper.find('.oc-panel-header').exists()).toBe(true)
    expect(wrapper.text()).toContain('Inspector')
  })

  it('uses scroll body mode when enabled', () => {
    const wrapper = mount(OcPanelSection, {
      props: {
        scrollBody: true,
      },
      slots: {
        default: '<div>content</div>',
      },
    })

    expect(wrapper.find('.oc-panel-scroll-body').exists()).toBe(true)
    expect(wrapper.find('.oc-scroll-area--y').exists()).toBe(true)
  })

  it('supports overlay tone without removing section structure', () => {
    const wrapper = mount(OcPanelSection, {
      props: {
        title: 'Overlay Inspector',
        tone: 'overlay',
      },
      slots: {
        default: '<div>body</div>',
      },
    })

    expect(wrapper.classes()).toContain('oc-panel-section--tone-overlay')
    expect(wrapper.find('.oc-panel-header').exists()).toBe(true)
  })

  it('supports collapsed mode and semantic layout props', () => {
    const wrapper = mount(OcPanelSection, {
      props: {
        title: 'Collapsed Section',
        collapsed: true,
        headerInset: 'comfortable',
        headerDensity: 'comfortable',
        bodyInset: 'comfortable',
      },
      slots: {
        default: '<div>body</div>',
      },
    })

    expect(wrapper.classes()).toContain('is-collapsed')
    expect(wrapper.classes()).toContain('oc-panel-section--header-inset-comfortable')
    expect(wrapper.classes()).toContain('oc-panel-section--header-density-comfortable')
    expect(wrapper.classes()).toContain('oc-panel-section--body-inset-comfortable')
  })

  it('supports fill mode for full-height panel hosting', () => {
    const wrapper = mount(OcPanelSection, {
      props: {
        fill: true,
      },
      slots: {
        default: '<div>content</div>',
      },
    })

    expect(wrapper.classes()).toContain('is-fill')
  })
})
