import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { describe, expect, it } from 'vitest'
import OcOptionGroup from './OcOptionGroup.vue'

describe('OcOptionGroup', () => {
  it('fills its parent and exposes option data to the custom renderer', async () => {
    const wrapper = mount(OcOptionGroup, {
      props: {
        modelValue: 'start',
        fill: true,
        options: [
          { value: 'start', label: 'Start', shortLabel: 'S' },
          { value: 'end', label: 'End', shortLabel: 'E' },
        ],
      },
      slots: {
        option: ({ option }: { option: { shortLabel?: string } }) =>
          h('span', { class: 'test-option' }, option.shortLabel),
      },
    })

    expect(wrapper.classes()).toContain('oc-option-group--fill')
    expect(wrapper.findAll('.test-option').map((node) => node.text())).toEqual(['S', 'E'])

    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['end']])
  })

  it('implements radio semantics and keyboard selection', async () => {
    const wrapper = mount(OcOptionGroup, {
      attachTo: document.body,
      props: {
        modelValue: 'center',
        columns: 3,
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
          { value: 'right', label: 'Right' },
          { value: 'bottom-left', label: 'Bottom left' },
        ],
      },
    })

    expect(wrapper.attributes('role')).toBe('radiogroup')
    const radios = wrapper.findAll('[role="radio"]')
    expect(radios.map((radio) => radio.attributes('tabindex'))).toEqual(['-1', '0', '-1', '-1'])
    expect(radios[1].attributes('aria-checked')).toBe('true')

    await radios[1].trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['left']])
    expect(document.activeElement).toBe(radios[0].element)

    await radios[0].trigger('keydown', { key: 'End' })
    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates[updates.length - 1]).toEqual(['bottom-left'])
    wrapper.unmount()
  })
})
