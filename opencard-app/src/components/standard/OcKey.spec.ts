import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcKey from './OcKey.vue'

describe('OcKey', () => {
  it('renders a kbd element with the oc-key class and no content by default', () => {
    const wrapper = mount(OcKey)

    expect(wrapper.element.tagName).toBe('KBD')
    expect(wrapper.classes()).toContain('oc-key')
    expect(wrapper.text()).toBe('')
  })

  it('renders default slot content inside the key', () => {
    const wrapper = mount(OcKey, { slots: { default: 'Ctrl' } })

    expect(wrapper.get('.oc-key').text()).toBe('Ctrl')
  })
})
