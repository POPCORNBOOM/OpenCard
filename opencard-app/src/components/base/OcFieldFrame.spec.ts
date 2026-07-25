import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcFieldFrame from './OcFieldFrame.vue'

describe('OcFieldFrame', () => {
  it('keeps composition slots and forwards root attributes', () => {
    const wrapper = mount(OcFieldFrame, {
      attrs: { class: 'custom-frame', style: 'width: 123px', 'data-test': 'frame' },
      slots: { prefix: 'P', default: '<input />', suffix: 'S' },
    })

    expect(wrapper.classes()).toContain('custom-frame')
    expect(wrapper.attributes('data-test')).toBe('frame')
    expect(wrapper.attributes('style')).toContain('width: 123px')
    expect(wrapper.get('.oc-field-frame__prefix').text()).toBe('P')
    expect(wrapper.get('.oc-field-frame__suffix').text()).toBe('S')
  })

  it('projects shared field states to classes and aria attributes', () => {
    const wrapper = mount(OcFieldFrame, {
      props: { disabled: true, readonly: true, invalid: true, busy: true },
    })

    expect(wrapper.classes()).toEqual(expect.arrayContaining([
      'oc-field-frame--disabled',
      'oc-field-frame--readonly',
      'oc-field-frame--invalid',
      'oc-field-frame--busy',
    ]))
    expect(wrapper.attributes()).toMatchObject({
      'aria-disabled': 'true',
      'aria-readonly': 'true',
      'aria-invalid': 'true',
      'aria-busy': 'true',
    })
  })
})
