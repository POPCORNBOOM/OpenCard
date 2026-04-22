import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcOptionGroup, { type OcOptionGroupItem } from './OcOptionGroup.vue'

const options: OcOptionGroupItem[] = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

describe('OcOptionGroup', () => {
  it('assigns roving tabindex to the selected option', () => {
    const wrapper = mount(OcOptionGroup, {
      props: {
        modelValue: 'center',
        options,
        ariaLabel: 'align',
      },
    })

    const radios = wrapper.findAll('[role="radio"]')
    expect(radios[1].attributes('tabindex')).toBe('0')
    expect(radios[0].attributes('tabindex')).toBe('-1')
    expect(radios[2].attributes('tabindex')).toBe('-1')
  })

  it('supports arrow navigation and skips disabled options', async () => {
    const wrapper = mount(OcOptionGroup, {
      props: {
        modelValue: 'left',
        options: [
          options[0],
          { ...options[1], disabled: true },
          options[2],
        ],
        ariaLabel: 'align',
      },
    })

    const radios = wrapper.findAll('[role="radio"]')
    await radios[0].trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['right']])
    expect(radios[2].attributes('tabindex')).toBe('0')
  })

  it('handles enter and space selection, and respects disabled group', async () => {
    const wrapper = mount(OcOptionGroup, {
      props: {
        modelValue: 'left',
        options,
        ariaLabel: 'align',
      },
    })

    const radios = wrapper.findAll('[role="radio"]')
    await radios[2].trigger('focus')
    await radios[2].trigger('keydown', { key: 'Enter' })
    await radios[2].trigger('keydown', { key: ' ' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['right'], ['right']])

    await wrapper.setProps({ disabled: true })
    await radios[2].trigger('keydown', { key: 'Enter' })

    expect(wrapper.emitted('update:modelValue')).toEqual([['right'], ['right']])
  })
})
