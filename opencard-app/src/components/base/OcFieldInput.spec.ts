import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcFieldInput from './OcFieldInput.vue'

describe('OcFieldInput', () => {
  it('renders different native controls via as prop', () => {
    const textarea = mount(OcFieldInput, {
      props: { as: 'textarea' },
      attrs: { placeholder: 'write here' },
    })
    expect(textarea.find('textarea').exists()).toBe(true)
    expect(textarea.find('textarea').attributes('placeholder')).toBe('write here')

    const select = mount(OcFieldInput, {
      props: { as: 'select' },
      slots: {
        default: '<option value="a">A</option>',
      },
    })
    expect(select.find('select').exists()).toBe(true)
  })

  it('exposes focus and blur methods', async () => {
    const wrapper = mount(OcFieldInput, { attachTo: document.body })
    const input = wrapper.find('input').element

    ;(wrapper.vm as { focus: () => void; blur: () => void }).focus()
    expect(document.activeElement).toBe(input)

    ;(wrapper.vm as { focus: () => void; blur: () => void }).blur()
    expect(document.activeElement).not.toBe(input)
  })
})
