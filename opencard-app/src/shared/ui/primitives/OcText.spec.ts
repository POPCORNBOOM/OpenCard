import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcText from './OcText.vue'

describe('OcText', () => {
  it('maps tone and size to semantic classes', () => {
    const wrapper = mount(OcText, {
      props: {
        as: 'p',
        tone: 'info',
        size: 'title',
      },
      slots: {
        default: 'Token text',
      },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('p')
    expect(wrapper.classes()).toContain('oc-text--tone-info')
    expect(wrapper.classes()).toContain('oc-text--size-title')
  })

  it('applies truncate state class when enabled', () => {
    const wrapper = mount(OcText, {
      props: { truncate: true },
      slots: { default: 'long line' },
    })

    expect(wrapper.classes()).toContain('is-truncate')
  })
})
