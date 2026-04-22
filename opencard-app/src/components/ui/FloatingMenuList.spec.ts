import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FloatingMenuList from './FloatingMenuList.vue'

describe('FloatingMenuList', () => {
  it('syncs aria-expanded with submenu hover and focus state', async () => {
    const wrapper = mount(FloatingMenuList, {
      props: {
        items: [
          {
            key: 'parent',
            label: 'Parent',
            children: [
              {
                key: 'child',
                label: 'Child',
              },
            ],
          },
        ],
      },
    })

    const item = wrapper.get('.floating-menu-item')
    const button = wrapper.get('.floating-menu-button')

    expect(button.attributes('aria-expanded')).toBe('false')

    await item.trigger('mouseenter')
    expect(button.attributes('aria-expanded')).toBe('true')

    await item.trigger('mouseleave')
    expect(button.attributes('aria-expanded')).toBe('false')

    await item.trigger('focusin')
    expect(button.attributes('aria-expanded')).toBe('true')

    await item.trigger('focusout', { relatedTarget: null })
    expect(button.attributes('aria-expanded')).toBe('false')
  })
})
