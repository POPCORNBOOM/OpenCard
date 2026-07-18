import { mount } from '@vue/test-utils'
import type { Component } from 'vue'
import { describe, expect, it } from 'vitest'
import OcButton from './OcButton.vue'
import OcCheckbox from './OcCheckbox.vue'
import OcFieldInput from './OcFieldInput.vue'
import OcIcon from './OcIcon.vue'
import OcPanel from './OcPanel.vue'
import OcActionButton from '../standard/OcActionButton.vue'
import OcActionGroup from '../standard/OcActionGroup.vue'
import OcBar from '../standard/OcBar.vue'
import OcCard from '../standard/OcCard.vue'

describe('OC attribute forwarding', () => {
  const cases: Array<{ component: Component; props?: Record<string, unknown> }> = [
    { component: OcButton },
    { component: OcFieldInput },
    { component: OcIcon },
    { component: OcPanel },
    { component: OcActionButton, props: { action: { key: 'edit', title: 'Edit' } } },
    { component: OcActionGroup, props: { actions: [{ key: 'edit', label: 'Edit' }] } },
    { component: OcBar, props: { title: 'Title' } },
    { component: OcCard, props: { title: 'Title' } },
  ]

  it.each(cases)('forwards class, style and data attrs to the root', ({ component, props }) => {
    const wrapper = mount(component, {
      props,
      attrs: { class: 'consumer-class', style: 'opacity: 0.7', 'data-consumer': 'yes' },
    })

    expect(wrapper.classes()).toContain('consumer-class')
    expect(wrapper.attributes('style')).toContain('opacity: 0.7')
    expect(wrapper.attributes('data-consumer')).toBe('yes')
  })

  it('keeps checkbox layout attrs on the label and form attrs on the input', () => {
    const wrapper = mount(OcCheckbox, {
      attrs: { class: 'consumer-class', style: 'width: 20px', name: 'enabled', 'aria-label': 'Enabled' },
    })

    expect(wrapper.classes()).toContain('consumer-class')
    expect(wrapper.attributes('style')).toContain('width: 20px')
    expect(wrapper.get('input').attributes('name')).toBe('enabled')
    expect(wrapper.get('input').attributes('aria-label')).toBe('Enabled')
  })

  it.each([
    ['none', 'oc-field-input--resize-none'],
    ['vertical', 'oc-field-input--resize-vertical'],
    ['horizontal', 'oc-field-input--resize-horizontal'],
    ['both', 'oc-field-input--resize-both'],
  ] as const)('maps textarea resize=%s to an explicit class', (resize, expectedClass) => {
    const wrapper = mount(OcFieldInput, {
      props: { as: 'textarea', resize },
    })

    expect(wrapper.classes()).toContain(expectedClass)
  })
})
