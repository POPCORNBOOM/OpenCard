import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcBar from './OcBar.vue'

describe('OcBar', () => {
  it('renders start/default/end slots', () => {
    const wrapper = mount(OcBar, {
      slots: {
        start: '<span class="slot-start">start</span>',
        default: '<span class="slot-main">main</span>',
        end: '<span class="slot-end">end</span>',
      },
    })

    expect(wrapper.find('.slot-start').exists()).toBe(true)
    expect(wrapper.find('.slot-main').exists()).toBe(true)
    expect(wrapper.find('.slot-end').exists()).toBe(true)
  })

  it('supports kind and border classes', () => {
    const wrapper = mount(OcBar, {
      props: {
        kind: 'top',
        border: 'bottom',
      },
      slots: {
        default: '<span>content</span>',
      },
    })

    expect(wrapper.classes()).toContain('oc-bar--kind-top')
    expect(wrapper.classes()).toContain('oc-bar--border-bottom')
  })

  it('supports semantic spacing and inset props', () => {
    const wrapper = mount(OcBar, {
      props: {
        spacing: 'spacious',
        inset: 'compact',
      },
      slots: {
        default: '<span>content</span>',
      },
    })

    expect(wrapper.classes()).toContain('oc-bar--spacing-spacious')
    expect(wrapper.classes()).toContain('oc-bar--inset-compact')
  })
})
