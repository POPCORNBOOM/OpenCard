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

  it('keeps legacy fixed/min string sizes in horizontal mode', () => {
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

  it('resolves semantic fixed/min sizes', () => {
    const wrapper = mount(OcSplitPane, {
      props: {
        orientation: 'vertical',
        fixedPane: 'primary',
        fixedSize: 'md',
        primaryMinSize: 'sm',
        secondaryMinSize: 'lg',
      },
      slots: {
        primary: '<div>Primary</div>',
        secondary: '<div>Secondary</div>',
      },
    })

    const primaryPane = wrapper.find('.oc-split-pane__pane--primary')
    const secondaryPane = wrapper.find('.oc-split-pane__pane--secondary')
    expect(wrapper.classes()).toContain('oc-split-pane--vertical')
    expect(primaryPane.attributes('style')).toContain('flex-basis: var(--oc-split-pane-fixed-md, 320px);')
    expect(primaryPane.attributes('style')).toContain('height: var(--oc-split-pane-fixed-md, 320px);')
    expect(primaryPane.attributes('style')).toContain('min-height: var(--oc-split-pane-min-sm, 140px);')
    expect(secondaryPane.attributes('style')).toContain('min-height: var(--oc-split-pane-min-lg, 220px);')
  })

  it('resolves workspace semantic size for fixed/min props', () => {
    const wrapper = mount(OcSplitPane, {
      props: {
        orientation: 'horizontal',
        fixedPane: 'secondary',
        fixedSize: 'workspace',
        secondaryMinSize: 'workspace',
      },
      slots: {
        primary: '<div>Primary</div>',
        secondary: '<div>Secondary</div>',
      },
    })

    const secondaryPane = wrapper.find('.oc-split-pane__pane--secondary')
    expect(secondaryPane.attributes('style')).toContain('flex-basis: var(--oc-split-pane-fixed-workspace, var(--card-editor-tree-panel-height, 320px));')
    expect(secondaryPane.attributes('style')).toContain('width: var(--oc-split-pane-fixed-workspace, var(--card-editor-tree-panel-height, 320px));')
    expect(secondaryPane.attributes('style')).toContain('min-width: var(--oc-split-pane-min-workspace, var(--card-editor-min-property-panel-height, 180px));')
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
