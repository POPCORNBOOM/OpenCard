import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcPropertyRow from './OcPropertyRow.vue'

describe('OcPropertyRow', () => {
  it('renders label and content slot', () => {
    const wrapper = mount(OcPropertyRow, {
      props: { label: 'Width' },
      slots: {
        default: '<input value="540" />',
      },
    })

    expect(wrapper.text()).toContain('Width')
    expect(wrapper.find('.oc-property-row__content input').exists()).toBe(true)
  })

  it('renders label icon when provided', () => {
    const wrapper = mount(OcPropertyRow, {
      props: {
        label: 'Name',
        labelIcon: 'icon.symbol-string',
      },
    })

    expect(wrapper.find('.oc-property-row__label-icon').exists()).toBe(true)
  })
})
