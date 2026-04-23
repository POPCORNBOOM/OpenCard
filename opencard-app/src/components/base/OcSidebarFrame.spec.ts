import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcSidebarFrame from './OcSidebarFrame.vue'

describe('OcSidebarFrame', () => {
  it('renders activity and panel slots by default', () => {
    const wrapper = mount(OcSidebarFrame, {
      slots: {
        activity: '<div class="activity-slot">activity</div>',
        panel: '<div class="panel-slot">panel</div>',
      },
    })

    expect(wrapper.find('.activity-slot').exists()).toBe(true)
    expect(wrapper.find('.panel-slot').exists()).toBe(true)
  })

  it('hides panel region when panelVisible is false', () => {
    const wrapper = mount(OcSidebarFrame, {
      props: {
        panelVisible: false,
      },
      slots: {
        activity: '<div>activity</div>',
        panel: '<div class="panel-slot">panel</div>',
      },
    })

    expect(wrapper.find('.oc-sidebar-frame__panel').exists()).toBe(false)
    expect(wrapper.find('.panel-slot').exists()).toBe(false)
  })

  it('applies custom activity/panel widths via style variables', () => {
    const wrapper = mount(OcSidebarFrame, {
      props: {
        activityWidth: '72px',
        panelWidth: '300px',
      },
      slots: {
        activity: '<div>activity</div>',
        panel: '<div>panel</div>',
      },
    })

    expect(wrapper.attributes('style')).toContain('--oc-sidebar-frame-activity-width: 72px;')
    expect(wrapper.attributes('style')).toContain('--oc-sidebar-frame-panel-width: 300px;')
  })
})
