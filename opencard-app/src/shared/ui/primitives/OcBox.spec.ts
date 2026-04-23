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

  it('applies style props for sizing, positioning, and flex alignment', () => {
    const wrapper = mount(OcBox, {
      props: {
        absolute: true,
        inset: '0 auto auto 0',
        width: '240px',
        height: '120px',
        pointer: 'none',
        align: 'end',
        justify: 'between',
        overflow: 'hidden',
      },
    })

    const style = wrapper.attributes('style')
    expect(wrapper.classes()).toContain('is-absolute')
    expect(style).toContain('inset: 0 auto auto 0;')
    expect(style).toContain('width: 240px;')
    expect(style).toContain('height: 120px;')
    expect(style).toContain('pointer-events: none;')
    expect(style).toContain('align-items: flex-end;')
    expect(style).toContain('justify-content: space-between;')
    expect(style).toContain('overflow: hidden;')
  })
})
