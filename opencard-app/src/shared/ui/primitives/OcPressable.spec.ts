import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcPressable from './OcPressable.vue'

describe('OcPressable', () => {
  it('renders expected variant and size classes', () => {
    const wrapper = mount(OcPressable, {
      props: {
        variant: 'primary',
        size: 'lg',
      },
      slots: {
        default: 'Action',
      },
    })

    expect(wrapper.classes()).toContain('oc-pressable--primary')
    expect(wrapper.classes()).toContain('oc-pressable--size-lg')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('maps disabled prop to native button attribute', () => {
    const wrapper = mount(OcPressable, {
      props: {
        disabled: true,
      },
      slots: {
        default: 'Disabled',
      },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })
})

