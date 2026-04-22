import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcResizer from './OcResizer.vue'

describe('OcResizer', () => {
  it('renders separator semantics and orientation class', () => {
    const wrapper = mount(OcResizer, {
      props: {
        orientation: 'horizontal',
        ariaLabel: 'Resize rows',
      },
    })

    expect(wrapper.attributes('role')).toBe('separator')
    expect(wrapper.attributes('aria-orientation')).toBe('horizontal')
    expect(wrapper.attributes('aria-label')).toBe('Resize rows')
    expect(wrapper.classes()).toContain('oc-resizer--horizontal')
  })

  it('emits mousedown and marks active state', async () => {
    const wrapper = mount(OcResizer, {
      props: {
        active: true,
      },
    })

    await wrapper.trigger('mousedown')
    expect(wrapper.emitted('mousedown')).toHaveLength(1)
    expect(wrapper.classes()).toContain('is-active')
  })

  it('supports edge variant without changing separator semantics', () => {
    const wrapper = mount(OcResizer, {
      props: {
        orientation: 'vertical',
        variant: 'edge',
      },
    })

    expect(wrapper.attributes('role')).toBe('separator')
    expect(wrapper.classes()).toContain('oc-resizer--edge')
  })
})
