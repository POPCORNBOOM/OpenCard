import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiKitShowcase from './UiKitShowcase.vue'

describe('UiKitShowcase', () => {
  it('renders three major groups and key component entries', () => {
    const wrapper = mount(UiKitShowcase)

    expect(wrapper.find('#foundation').exists()).toBe(true)
    expect(wrapper.find('#primitives').exists()).toBe(true)
    expect(wrapper.find('#base').exists()).toBe(true)

    const text = wrapper.text()
    expect(text).toContain('OcPressable')
    expect(text).toContain('OcButton')
  })
})

