import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UiKitShowcase from './UiKitShowcase.vue'
import { UI_KIT_SECTIONS } from './ui-kit/catalog'

describe('UiKitShowcase', () => {
  it('renders three major groups, matrix columns, and full catalog cards', () => {
    const wrapper = mount(UiKitShowcase)

    expect(wrapper.find('#foundation').exists()).toBe(true)
    expect(wrapper.find('#primitives').exists()).toBe(true)
    expect(wrapper.find('#base').exists()).toBe(true)

    const expectedCardCount = UI_KIT_SECTIONS.reduce((total, section) => total + section.examples.length, 0)
    expect(wrapper.findAll('.showcase-card').length).toBe(expectedCardCount)

    const text = wrapper.text()
    expect(text).toContain('Default')
    expect(text).toContain('Variants')
    expect(text).toContain('States')
    expect(text).toContain('Layout')
    expect(text).toContain('OcPressable')
    expect(text).toContain('OcButton')
  })
})
