import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcColorPicker from './OcColorPicker.vue'

describe('OcColorPicker', () => {
  it('uses a themed popover without a native color input', async () => {
    const wrapper = mount(OcColorPicker, {
      props: { modelValue: '#112233' },
      attachTo: document.body,
    })

    await wrapper.get('.oc-color-picker__trigger').trigger('click')
    expect(document.body.querySelector('.oc-color-picker__panel')).not.toBeNull()
    expect(document.body.querySelector('input[type="color"]')).toBeNull()
    wrapper.unmount()
  })

  it('previews valid hex input and commits it explicitly', async () => {
    const wrapper = mount(OcColorPicker, {
      props: { modelValue: '#112233' },
      attachTo: document.body,
    })
    await wrapper.get('.oc-color-picker__trigger').trigger('click')
    const input = document.body.querySelector<HTMLInputElement>('.oc-color-picker__hex')!
    input.value = '#AABBCC'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('preview')).toContainEqual(['#AABBCC'])
    expect(wrapper.emitted('commit')).toEqual([['#AABBCC']])
    expect(wrapper.emitted('update:modelValue')).toEqual([['#AABBCC']])
    document.body.querySelector<HTMLElement>('.oc-color-picker__panel')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('cancel')).toBeUndefined()
    wrapper.unmount()
  })

  it('reports cancellation after restoring an uncommitted preview', async () => {
    const wrapper = mount(OcColorPicker, {
      props: { modelValue: '#112233' },
      attachTo: document.body,
    })
    await wrapper.get('.oc-color-picker__trigger').trigger('click')
    const panel = document.body.querySelector<HTMLElement>('.oc-color-picker__panel')!
    const input = panel.querySelector<HTMLInputElement>('.oc-color-picker__hex')!
    input.value = '#AABBCC'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    const previews = wrapper.emitted('preview') ?? []
    expect(previews[previews.length - 1]).toEqual(['#112233'])
    expect(wrapper.emitted('cancel')).toEqual([[]])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    wrapper.unmount()
  })
})
