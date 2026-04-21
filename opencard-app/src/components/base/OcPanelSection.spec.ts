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
})

