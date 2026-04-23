import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcChip from './OcChip.vue'

describe('OcChip', () => {
  it('renders chip content', () => {
    const wrapper = mount(OcChip, {
      slots: {
        default: '<span class="chip-content">chip</span>',
      },
    })

    expect(wrapper.find('.chip-content').exists()).toBe(true)
  })

  it('supports size/tone/truncate variants', () => {
    const wrapper = mount(OcChip, {
      props: {
        size: 'md',
        tone: 'info',
        truncate: true,
      },
      slots: {
        default: 'content',
      },
    })

    expect(wrapper.classes()).toContain('oc-chip--size-md')
    expect(wrapper.classes()).toContain('oc-chip--tone-info')
    expect(wrapper.classes()).toContain('is-truncate')
  })

  it('maps maxWidth token to semantic class', () => {
    const wrapper = mount(OcChip, {
      props: {
        maxWidth: 'md',
      },
      slots: {
        default: 'content',
      },
    })

    expect(wrapper.classes()).toContain('oc-chip--max-width-md')
  })

  it('renders semantic icon props without bypassing the default slot', () => {
    const wrapper = mount(OcChip, {
      props: {
        icon: 'icon.warning',
        iconTone: 'warning',
      },
      slots: {
        default: 'content',
      },
    })

    const icon = wrapper.find('.oc-chip__icon')
    expect(icon.exists()).toBe(true)
    expect(icon.attributes('style')).toContain('var(--icon-warning)')
    expect(wrapper.text()).toContain('content')
  })

  it('keeps slot-based icon composition compatible', () => {
    const wrapper = mount(OcChip, {
      props: {
        icon: 'icon.warning',
      },
      slots: {
        icon: '<span class="chip-icon-slot">slot-icon</span>',
        default: 'content',
      },
    })

    expect(wrapper.find('.chip-icon-slot').exists()).toBe(true)
    expect(wrapper.find('.oc-chip__icon').exists()).toBe(false)
  })
})
