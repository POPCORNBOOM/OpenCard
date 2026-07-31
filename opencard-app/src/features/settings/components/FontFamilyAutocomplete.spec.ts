import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcAutocompletePopover from '../../../components/standard/OcAutocompletePopover.vue'
import FontFamilyAutocomplete from './FontFamilyAutocomplete.vue'

afterEach(() => vi.useRealTimers())

describe('FontFamilyAutocomplete', () => {
  it('completes the active semicolon segment and commits the fallback chain', async () => {
    vi.useFakeTimers()
    const wrapper = mount(FontFamilyAutocomplete, {
      props: {
        modelValue: 'Inter',
        fontFamilies: ['Inter', 'Microsoft YaHei UI', 'SimSun'],
        label: 'UI font',
        placeholder: 'System default',
      },
    })
    const input = wrapper.get('input')

    await input.setValue('Inter; Micro')
    expect(wrapper.getComponent(OcAutocompletePopover).props('items')).toEqual([
      { key: 'Microsoft YaHei UI', label: 'Microsoft YaHei UI' },
    ])

    wrapper.getComponent(OcAutocompletePopover).vm.$emit('select', 'Microsoft YaHei UI')
    await wrapper.vm.$nextTick()
    expect((input.element as HTMLInputElement).value).toBe('Inter; Microsoft YaHei UI')

    await input.trigger('blur')
    await vi.runAllTimersAsync()
    expect(wrapper.emitted('commit')).toEqual([['Inter; Microsoft YaHei UI']])
  })
})
