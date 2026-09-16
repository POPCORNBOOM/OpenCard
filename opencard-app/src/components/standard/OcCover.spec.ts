import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcCover from './OcCover.vue'

describe('OcCover', () => {
  it('renders an empty frame without a visual', () => {
    const wrapper = mount(OcCover)

    expect(wrapper.get('.oc-cover').classes()).toContain('oc-cover--empty')
    expect(wrapper.find('.oc-cover__visual').exists()).toBe(false)
  })

  it('renders an image visual covering the frame with its alt text', () => {
    const wrapper = mount(OcCover, {
      props: { visual: { type: 'image', src: 'asset://cover.png', label: 'Theme cover' } },
    })

    expect(wrapper.get('.oc-cover').classes()).toContain('oc-cover--image')
    const image = wrapper.get('.oc-cover__visual')
    expect(image.attributes('src')).toBe('asset://cover.png')
    expect(image.attributes('alt')).toBe('Theme cover')
  })

  it('falls back to the label prop when the visual carries no name', () => {
    const wrapper = mount(OcCover, {
      props: { visual: { type: 'image', src: 'asset://cover.png' }, label: 'Cover' },
    })

    expect(wrapper.get('.oc-cover__visual').attributes('alt')).toBe('Cover')
  })

  it('hides an image that fails to load until the source changes', async () => {
    const wrapper = mount(OcCover, {
      props: { visual: { type: 'image', src: 'asset://broken.png' } },
    })

    await wrapper.get('.oc-cover__visual').trigger('error')
    expect(wrapper.find('.oc-cover__visual').exists()).toBe(false)
    expect(wrapper.get('.oc-cover').classes()).toContain('oc-cover--empty')

    await wrapper.setProps({ visual: { type: 'image', src: 'asset://replaced.png' } })
    expect(wrapper.get('.oc-cover__visual').attributes('src')).toBe('asset://replaced.png')
  })

  it('keeps an icon visual at its own size instead of stretching it', () => {
    const wrapper = mount(OcCover, {
      props: { visual: { type: 'icon', icon: 'file.package' }, size: 'lg' },
    })

    expect(wrapper.get('.oc-cover').classes()).toContain('oc-cover--icon')
    expect(wrapper.get('.oc-cover__visual').classes()).toContain('oc-icon--lg')
  })
})
