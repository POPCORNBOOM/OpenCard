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

  it('applies maxWidth style when provided', () => {
    const wrapper = mount(OcChip, {
      props: {
        maxWidth: '180px',
      },
      slots: {
        default: 'content',
      },
    })

    expect(wrapper.attributes('style')).toContain('max-width: 180px;')
  })
})
