import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcScrollArea from './OcScrollArea.vue'

describe('OcScrollArea', () => {
  it('defaults to y-axis scrolling', () => {
    const wrapper = mount(OcScrollArea)
    expect(wrapper.classes()).toContain('oc-scroll-area--y')
  })

  it('supports axis and tag overrides', () => {
    const wrapper = mount(OcScrollArea, {
      props: {
        as: 'section',
        axis: 'both',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('section')
    expect(wrapper.classes()).toContain('oc-scroll-area--both')
  })
})
