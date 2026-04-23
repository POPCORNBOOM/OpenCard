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
        fill: true,
        relative: true,
      },
    })

    expect(wrapper.classes()).toContain('is-inline')
    expect(wrapper.classes()).toContain('is-center')
    expect(wrapper.classes()).toContain('is-grow')
    expect(wrapper.classes()).toContain('is-scroll-y')
    expect(wrapper.classes()).toContain('is-fill')
    expect(wrapper.classes()).toContain('is-relative')
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

  it('maps semantic sizing, positioning, and flex alignment props to classes', () => {
    const wrapper = mount(OcBox, {
      props: {
        absolute: true,
        inset: 'origin',
        width: 'full',
        height: 'full',
        pointer: 'none',
        align: 'end',
        justify: 'between',
        overflow: 'hidden',
      },
    })

    expect(wrapper.classes()).toContain('is-absolute')
    expect(wrapper.classes()).toContain('oc-box--inset-origin')
    expect(wrapper.classes()).toContain('oc-box--width-full')
    expect(wrapper.classes()).toContain('oc-box--height-full')
    expect(wrapper.classes()).toContain('oc-box--pointer-none')
    expect(wrapper.classes()).toContain('oc-box--align-end')
    expect(wrapper.classes()).toContain('oc-box--justify-between')
    expect(wrapper.classes()).toContain('oc-box--overflow-hidden')
  })
})
