import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import OcTab from './OcTab.vue'

describe('OcTab', () => {
  it('fills the panel wrapper when the tab container is filled', () => {
    const wrapper = mount(OcTab, {
      props: {
        activeKey: 'overview',
        fill: true,
        tabs: [
          {
            key: 'overview',
            label: 'Overview',
          },
        ],
      },
      slots: {
        panel: '<div class="panel-content">Panel content</div>',
      },
      global: {
        stubs: {
          OcBar: {
            props: ['icon', 'title'],
            template: '<button class="oc-bar"><slot /></button>',
          },
          OcButton: {
            template: '<button class="oc-button" />',
          },
          OcPanel: {
            props: {
              fill: Boolean,
              grow: Boolean,
            },
            template:
              '<div class="oc-panel" v-bind="$attrs" :class="[fill && \'is-fill\', grow && \'is-grow\']"><slot /></div>',
          },
        },
      },
    })

    const panels = wrapper.findAll('.oc-tab > .oc-panel')
    const panelWithContent = wrapper.findAll('.oc-tab > .oc-panel').find((panel) =>
      panel.find('.panel-content').exists(),
    )

    expect(wrapper.find('.oc-tab').classes()).toContain('is-fill')
    expect(panels).toHaveLength(2)
    expect(panelWithContent).toBeDefined()
    expect(panelWithContent?.classes()).toContain('is-fill')
    expect(panelWithContent?.classes()).toContain('is-grow')
    expect(wrapper.find('.panel-content').exists()).toBe(true)
    expect(wrapper.text()).toContain('Panel content')
  })
})
