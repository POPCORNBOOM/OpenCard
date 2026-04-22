import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcSurface from './OcSurface.vue'

describe('OcSurface', () => {
  it('maps variant, radius, shadow and bordered classes', () => {
    const wrapper = mount(OcSurface, {
      props: {
        variant: 'floating',
        radius: 'lg',
        shadow: 'overlay',
        bordered: true,
      },
      slots: {
        default: 'surface',
      },
    })

    expect(wrapper.classes()).toContain('oc-surface--floating')
    expect(wrapper.classes()).toContain('oc-surface--radius-lg')
    expect(wrapper.classes()).toContain('oc-surface--shadow-overlay')
    expect(wrapper.classes()).toContain('is-bordered')
  })

  it('supports semantic tag override via as prop', () => {
    const wrapper = mount(OcSurface, {
      props: { as: 'section' },
    })

    expect(wrapper.element.tagName.toLowerCase()).toBe('section')
  })
})
