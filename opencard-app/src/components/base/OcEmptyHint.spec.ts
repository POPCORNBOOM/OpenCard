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

  it('supports tone, size, align, and inset variants', () => {
    const wrapper = mount(OcEmptyHint, {
      props: {
        tone: 'muted',
        size: 'label',
        align: 'start',
        inset: 'none',
      },
      slots: {
        default: 'empty',
      },
    })

    expect(wrapper.classes()).toContain('oc-empty-hint--tone-muted')
    expect(wrapper.classes()).toContain('oc-text--size-label')
    expect(wrapper.classes()).toContain('oc-empty-hint--align-start')
    expect(wrapper.classes()).toContain('oc-empty-hint--inset-none')
  })

  it('defaults to comfortable inset class', () => {
    const wrapper = mount(OcEmptyHint, {
      slots: {
        default: 'empty',
      },
    })

    expect(wrapper.classes()).toContain('oc-empty-hint--inset-comfortable')
  })
})
