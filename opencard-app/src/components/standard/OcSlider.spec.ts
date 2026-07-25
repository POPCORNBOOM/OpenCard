import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcSlider from './OcSlider.vue'

describe('OcSlider', () => {
  it('supports keyboard preview and commit without a native range input', async () => {
    const wrapper = mount(OcSlider, {
      props: { modelValue: 40, min: 0, max: 100, step: 2 },
    })

    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
    await wrapper.trigger('keydown', { key: 'ArrowRight' })

    expect(wrapper.emitted('preview')).toEqual([[42]])
    expect(wrapper.emitted('update:modelValue')).toEqual([[42]])
    expect(wrapper.emitted('commit')).toEqual([[42]])
    expect(wrapper.attributes('aria-valuenow')).toBe('42')
  })

  it('does not interact while disabled', async () => {
    const wrapper = mount(OcSlider, {
      props: { modelValue: 40, disabled: true },
    })
    await wrapper.trigger('keydown', { key: 'End' })
    expect(wrapper.emitted('preview')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('commit')).toBeUndefined()
    expect(wrapper.attributes('tabindex')).toBe('-1')
  })
})
