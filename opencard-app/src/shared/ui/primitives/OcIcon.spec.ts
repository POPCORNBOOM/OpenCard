import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcIcon from './OcIcon.vue'

describe('OcIcon', () => {
  it('renders semantic icon key and size class', () => {
    const wrapper = mount(OcIcon, {
      props: {
        name: 'icon.folder',
        size: 'lg',
      },
    })

    expect(wrapper.find('i').exists()).toBe(true)
    expect(wrapper.classes()).toContain('oc-icon--lg')
    expect(wrapper.attributes('style')).not.toContain('font-size')
    expect(wrapper.attributes('style')).not.toContain('width')
    expect(wrapper.attributes('style')).not.toContain('height')
  })

  it('maps tone to semantic icon token color', () => {
    const wrapper = mount(OcIcon, {
      props: {
        name: 'icon.warning',
        tone: 'warning',
      },
    })

    const style = wrapper.attributes('style')
    expect(style).toContain('var(--icon-warning)')
  })
})
