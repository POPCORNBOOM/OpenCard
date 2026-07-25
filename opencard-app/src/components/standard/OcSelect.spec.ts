import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcSelect from './OcSelect.vue'

const options = [
  { value: 'one', label: 'One' },
  { value: 'two', label: 'Two', disabled: true },
  { value: 'three', label: 'Three' },
]

describe('OcSelect', () => {
  it('opens a themed listbox and commits a selected option', async () => {
    const wrapper = mount(OcSelect, {
      props: { modelValue: 'one', options },
      attachTo: document.body,
    })

    await wrapper.get('.oc-select__trigger').trigger('click')
    const option = document.body.querySelectorAll<HTMLButtonElement>('.oc-select__option')[2]!
    option.click()
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['three']])
    expect(wrapper.emitted('commit')).toEqual([['three']])
    expect(wrapper.get('.oc-select__trigger').attributes('aria-expanded')).toBe('false')
    wrapper.unmount()
  })

  it('skips disabled options during keyboard navigation', async () => {
    const wrapper = mount(OcSelect, {
      props: { modelValue: 'one', options },
      attachTo: document.body,
    })
    const trigger = wrapper.get('.oc-select__trigger')

    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await trigger.trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['three']])
    wrapper.unmount()
  })

  it('keeps readonly controls focusable without opening them', async () => {
    const wrapper = mount(OcSelect, {
      props: { modelValue: 'one', options, readonly: true },
    })

    await wrapper.get('.oc-select__trigger').trigger('click')
    expect(wrapper.get('.oc-select__trigger').attributes('disabled')).toBeUndefined()
    expect(wrapper.get('.oc-select__trigger').attributes('aria-expanded')).toBe('false')
  })
})
