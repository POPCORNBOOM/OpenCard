import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcEmptyHint from './OcEmptyHint.vue'

describe('OcEmptyHint', () => {
  it('renders slot text', () => {
    const wrapper = mount(OcEmptyHint, {
      slots: {
        default: 'No content',
      },
    })

    expect(wrapper.text()).toContain('No content')
  })

  it('supports tone, size, and align variants', () => {
    const wrapper = mount(OcEmptyHint, {
      props: {
        tone: 'muted',
        size: 'label',
        align: 'start',
      },
      slots: {
        default: 'empty',
      },
    })

    expect(wrapper.classes()).toContain('oc-empty-hint--tone-muted')
    expect(wrapper.classes()).toContain('oc-empty-hint--size-label')
    expect(wrapper.classes()).toContain('oc-empty-hint--align-start')
  })

  it('applies padding style', () => {
    const wrapper = mount(OcEmptyHint, {
      props: {
        padding: '8px 12px',
      },
      slots: {
        default: 'empty',
      },
    })

    expect(wrapper.attributes('style')).toContain('padding: 8px 12px;')
  })
})
