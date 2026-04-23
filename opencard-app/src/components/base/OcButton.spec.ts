import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcButton from './OcButton.vue'

describe('OcButton', () => {
  it('maps semantic capability props to pressable classes', () => {
    const wrapper = mount(OcButton, {
      props: {
        variant: 'primary',
        size: 'lg',
        density: 'compact',
        radius: 'lg',
      },
      slots: {
        default: 'Save',
      },
    })

    expect(wrapper.classes()).toContain('oc-pressable--primary')
    expect(wrapper.classes()).toContain('oc-pressable--size-lg')
    expect(wrapper.classes()).toContain('oc-pressable--density-compact')
    expect(wrapper.classes()).toContain('oc-pressable--radius-lg')
    expect(wrapper.attributes('style')).toBeUndefined()
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
