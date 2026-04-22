import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcPressable from './OcPressable.vue'

describe('OcPressable', () => {
  it('renders expected variant and size classes', () => {
    const wrapper = mount(OcPressable, {
      props: {
        variant: 'primary',
        size: 'lg',
      },
      slots: {
        default: 'Action',
      },
    })

    expect(wrapper.classes()).toContain('oc-pressable--primary')
    expect(wrapper.classes()).toContain('oc-pressable--size-lg')
    expect(wrapper.attributes('type')).toBe('button')
  })

  it('maps disabled prop to native button attribute', () => {
    const wrapper = mount(OcPressable, {
      props: {
        disabled: true,
      },
      slots: {
        default: 'Disabled',
      },
    })

    expect(wrapper.attributes('disabled')).toBeDefined()
  })

  it('behaves like keyboard-activatable control when rendered as non-button', async () => {
    const clickSpy = vi.fn()
    const wrapper = mount(OcPressable, {
      props: {
        as: 'div',
      },
      attrs: {
        onClick: clickSpy,
      },
      slots: {
        default: 'Open',
      },
    })

    expect(wrapper.attributes('role')).toBe('button')
    expect(wrapper.attributes('tabindex')).toBe('0')

    await wrapper.trigger('keydown', { key: 'Enter' })
    await wrapper.trigger('keydown', { key: ' ' })

    expect(clickSpy).toHaveBeenCalledTimes(2)
  })

  it('does not activate keyboard click when disabled in non-button mode', async () => {
    const clickSpy = vi.fn()
    const wrapper = mount(OcPressable, {
      props: {
        as: 'div',
        disabled: true,
      },
      attrs: {
        onClick: clickSpy,
      },
      slots: {
        default: 'Open',
      },
    })

    expect(wrapper.attributes('aria-disabled')).toBe('true')
    expect(wrapper.attributes('tabindex')).toBe('-1')

    await wrapper.trigger('keydown', { key: 'Enter' })
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
