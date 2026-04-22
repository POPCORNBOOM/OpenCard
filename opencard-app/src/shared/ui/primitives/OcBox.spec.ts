import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcBox from './OcBox.vue'

describe('OcBox', () => {
  it('maps layout flags to utility classes', () => {
    const wrapper = mount(OcBox, {
      props: {
        inline: true,
        center: true,
        grow: true,
        scrollY: true,
      },
    })

    expect(wrapper.classes()).toContain('is-inline')
    expect(wrapper.classes()).toContain('is-center')
    expect(wrapper.classes()).toContain('is-grow')
    expect(wrapper.classes()).toContain('is-scroll-y')
  })

  it('supports tag override and external classes', () => {
    const wrapper = mount(OcBox, {
      props: {
        as: 'section',
        class: 'custom-class',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('section')
    expect(wrapper.classes()).toContain('custom-class')
  })
})
