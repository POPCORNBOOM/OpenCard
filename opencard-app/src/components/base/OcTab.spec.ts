import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcTab from './OcTab.vue'

describe('OcTab', () => {
  it('emits select when the tab root is clicked', async () => {
    const wrapper = mount(OcTab, {
      props: {
        label: 'Uno.opencard',
        active: true,
      },
    })

    await wrapper.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[]])
  })

  it('emits close without triggering select when the close action is clicked', async () => {
    const wrapper = mount(OcTab, {
      props: {
        label: 'Uno.opencard',
        active: true,
        closable: true,
      },
    })

    await wrapper.get('.oc-tab__close').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[]])
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('emits select on Enter and Space from the tab root', async () => {
    const wrapper = mount(OcTab, {
      props: {
        label: 'Uno.opencard',
        active: true,
      },
    })

    await wrapper.trigger('keydown', { key: 'Enter' })
    await wrapper.trigger('keydown', { key: ' ' })
    expect(wrapper.emitted('select')).toEqual([[], []])
  })

  it('renders dirty and tab accessibility state', () => {
    const wrapper = mount(OcTab, {
      props: {
        label: 'Uno.opencard',
        active: true,
        dirty: true,
      },
    })

    expect(wrapper.attributes('role')).toBe('tab')
    expect(wrapper.attributes('aria-selected')).toBe('true')
    expect(wrapper.find('.oc-tab__dirty-dot').exists()).toBe(true)
  })
})
