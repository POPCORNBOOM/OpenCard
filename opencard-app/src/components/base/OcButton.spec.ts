import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcButton from './OcButton.vue'

describe('OcButton', () => {
  it('maps variant to pressable classes', () => {
    const wrapper = mount(OcButton, {
      props: {
        variant: 'primary',
      },
      slots: {
        default: 'Save',
      },
    })

    expect(wrapper.classes()).toContain('oc-pressable--primary')
  })

  it('renders icon when icon prop is provided', () => {
    const wrapper = mount(OcButton, {
      props: {
        icon: 'icon.add',
      },
      slots: {
        default: 'Add',
      },
    })

    expect(wrapper.find('.oc-base-button__icon').exists()).toBe(true)
  })
})
