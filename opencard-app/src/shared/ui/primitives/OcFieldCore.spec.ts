import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcFieldCore from './OcFieldCore.vue'

describe('OcFieldCore', () => {
  it('defaults to chromed input and forwards attrs', () => {
    const wrapper = mount(OcFieldCore, {
      attrs: {
        placeholder: 'Type value',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('input')
    expect(wrapper.classes()).toContain('oc-field-core--variant-chromed')
    expect(wrapper.attributes('placeholder')).toBe('Type value')
  })

  it('supports select/textarea tags and non-chromed mode', () => {
    const select = mount(OcFieldCore, {
      props: { as: 'select' },
      slots: { default: '<option value="a">A</option>' },
    })
    expect(select.element.tagName.toLowerCase()).toBe('select')

    const textarea = mount(OcFieldCore, {
      props: { as: 'textarea', variant: 'plain' },
    })
    expect(textarea.element.tagName.toLowerCase()).toBe('textarea')
    expect(textarea.classes()).toContain('oc-field-core--variant-plain')
  })
})
