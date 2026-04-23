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

  it('applies semantic activity/panel size classes', () => {
    const wrapper = mount(OcSidebarFrame, {
      props: {
        activitySize: 'spacious',
        panelSize: 'spacious',
      },
      slots: {
        activity: '<div>activity</div>',
        panel: '<div>panel</div>',
      },
    })

    expect(wrapper.classes()).toContain('oc-sidebar-frame--activity-spacious')
    expect(wrapper.classes()).toContain('oc-sidebar-frame--panel-spacious')
  })
})
