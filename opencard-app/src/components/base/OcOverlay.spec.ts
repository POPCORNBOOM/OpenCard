import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcOverlay from './OcOverlay.vue'

describe('OcOverlay', () => {
  it('always uses full-size overlay hosting', () => {
    const wrapper = mount(OcOverlay, {
      slots: {
        default: '<div>base</div>',
        overlay: '<div>overlay</div>',
      },
    })

    expect(wrapper.classes()).toContain('oc-overlay')
  })

  it('renders base and overlay layers by default', () => {
    const wrapper = mount(OcOverlay, {
      slots: {
        default: '<div class="base-content">base</div>',
        overlay: '<div class="overlay-content">overlay</div>',
      },
    })

    expect(wrapper.find('.base-content').exists()).toBe(true)
    expect(wrapper.find('.oc-overlay__layer').exists()).toBe(true)
    expect(wrapper.find('.overlay-content').exists()).toBe(true)
  })

  it('hides overlay layer when visible is false', () => {
    const wrapper = mount(OcOverlay, {
      props: {
        visible: false,
      },
      slots: {
        default: '<div>base</div>',
        overlay: '<div>overlay</div>',
      },
    })

    expect(wrapper.find('.oc-overlay__layer').exists()).toBe(false)
  })

  it('applies non-interactive overlay state', () => {
    const wrapper = mount(OcOverlay, {
      props: {
        interactive: false,
      },
      slots: {
        default: '<div>base</div>',
        overlay: '<div>overlay</div>',
      },
    })

    expect(wrapper.find('.oc-overlay__layer').classes()).toContain('is-non-interactive')
  })

  it.each([
    ['none', /inset:\s0(?:px)?;/],
    ['compact', 'var(--oc-space-1)'],
    ['default', 'var(--oc-space-2)'],
    ['workspace', 'var(--card-editor-overlay-inset-y, 20px) var(--card-editor-overlay-inset-x, 24px)'],
  ] as const)('maps semantic inset "%s" to layer style', (inset, expectedInset) => {
    const wrapper = mount(OcOverlay, {
      props: {
        inset,
      },
      slots: {
        default: '<div>base</div>',
        overlay: '<div>overlay</div>',
      },
    })

    const overlayLayer = wrapper.find('.oc-overlay__layer')
    const inlineStyle = overlayLayer.attributes('style') ?? ''
    if (expectedInset instanceof RegExp) {
      expect(inlineStyle).toMatch(expectedInset)
      return
    }
    expect(inlineStyle).toContain(`inset: ${expectedInset};`)
  })

  it('keeps legacy inset string as fallback', () => {
    const wrapper = mount(OcOverlay, {
      props: {
        inset: '24px 12px 16px 8px',
      },
      slots: {
        default: '<div>base</div>',
        overlay: '<div>overlay</div>',
      },
    })

    const overlayLayer = wrapper.find('.oc-overlay__layer')
    expect(overlayLayer.attributes('style')).toContain('inset: 24px 12px 16px 8px;')
  })
})
