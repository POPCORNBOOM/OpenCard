import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcFocusRing from './OcFocusRing.vue'

describe('OcFocusRing', () => {
  it('renders slot content with default tag', () => {
    const wrapper = mount(OcFocusRing, {
      slots: {
        default: '<button type="button">Focus</button>',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('span')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('supports semantic tag override', () => {
    const wrapper = mount(OcFocusRing, {
      props: { as: 'div' },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('div')
  })
})
