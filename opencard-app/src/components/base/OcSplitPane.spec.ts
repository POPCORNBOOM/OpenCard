import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcSplitPane from './OcSplitPane.vue'

describe('OcSplitPane', () => {
  it('renders primary and secondary panes', () => {
    const wrapper = mount(OcSplitPane, {
      slots: {
        primary: '<div class="pane-primary">Primary</div>',
        secondary: '<div class="pane-secondary">Secondary</div>',
      },
    })

    expect(wrapper.find('.pane-primary').exists()).toBe(true)
    expect(wrapper.find('.pane-secondary').exists()).toBe(true)
    expect(wrapper.classes()).toContain('oc-split-pane--horizontal')
  })

  it('applies fixed secondary size in horizontal mode', () => {
    const wrapper = mount(OcSplitPane, {
      props: {
        orientation: 'horizontal',
        fixedPane: 'secondary',
        fixedSize: '320px',
        secondaryMinSize: '220px',
      },
      slots: {
        primary: '<div>Primary</div>',
        secondary: '<div>Secondary</div>',
      },
    })

    const secondaryPane = wrapper.find('.oc-split-pane__pane--secondary')
    expect(secondaryPane.attributes('style')).toContain('flex-basis: 320px;')
    expect(secondaryPane.attributes('style')).toContain('width: 320px;')
    expect(secondaryPane.attributes('style')).toContain('min-width: 220px;')
  })

  it('applies fixed primary size in vertical mode', () => {
    const wrapper = mount(OcSplitPane, {
      props: {
        orientation: 'vertical',
        fixedPane: 'primary',
        fixedSize: '280px',
        primaryMinSize: '140px',
      },
      slots: {
        primary: '<div>Primary</div>',
        secondary: '<div>Secondary</div>',
      },
    })

    const primaryPane = wrapper.find('.oc-split-pane__pane--primary')
    expect(wrapper.classes()).toContain('oc-split-pane--vertical')
    expect(primaryPane.attributes('style')).toContain('flex-basis: 280px;')
    expect(primaryPane.attributes('style')).toContain('height: 280px;')
    expect(primaryPane.attributes('style')).toContain('min-height: 140px;')
  })

  it('supports clip and radius options', () => {
    const wrapper = mount(OcSplitPane, {
      props: {
        clip: true,
        radius: 'md',
      },
      slots: {
        primary: '<div>Primary</div>',
        secondary: '<div>Secondary</div>',
      },
    })

    expect(wrapper.classes()).toContain('is-clip')
    expect(wrapper.classes()).toContain('oc-split-pane--radius-md')
  })
})
