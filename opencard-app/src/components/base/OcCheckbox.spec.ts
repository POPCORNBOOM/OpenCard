import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcCheckbox from './OcCheckbox.vue'

describe('OcCheckbox', () => {
  it('maps checked and disabled semantics to native checkbox state', () => {
    const wrapper = mount(OcCheckbox, {
      props: {
        checked: true,
        disabled: true,
        label: 'Auto save',
      },
    })

    const input = wrapper.get('input[type="checkbox"]')
    expect((input.element as HTMLInputElement).checked).toBe(true)
    expect(input.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('is-checked')
    expect(wrapper.classes()).toContain('is-disabled')
    expect(wrapper.text()).toContain('Auto save')
  })

  it('supports slot label content over label prop fallback', () => {
    const wrapper = mount(OcCheckbox, {
      props: {
        label: 'Fallback label',
      },
      slots: {
        default: 'Slot label',
      },
    })

    expect(wrapper.text()).toContain('Slot label')
    expect(wrapper.text()).not.toContain('Fallback label')
  })

  it('emits update:checked and change when toggled', async () => {
    const wrapper = mount(OcCheckbox, {
      props: {
        checked: false,
      },
    })

    const input = wrapper.get('input[type="checkbox"]')
    await input.setValue(true)

    expect(wrapper.emitted('update:checked')).toEqual([[true]])
    const changeEvents = wrapper.emitted('change')
    expect(changeEvents).toHaveLength(1)
    expect(changeEvents?.[0]?.[0]).toBe(true)
    expect(changeEvents?.[0]?.[1]).toBeInstanceOf(Event)
  })

  it('forwards native input attrs through component attrs', () => {
    const wrapper = mount(OcCheckbox, {
      attrs: {
        name: 'isEnabled',
        'aria-label': 'Enable feature',
      },
    })

    const input = wrapper.get('input[type="checkbox"]')
    expect(input.attributes('name')).toBe('isEnabled')
    expect(input.attributes('aria-label')).toBe('Enable feature')
  })

  it('keeps label optional when no slot or label prop is provided', () => {
    const wrapper = mount(OcCheckbox)

    expect(wrapper.find('.oc-checkbox__label').exists()).toBe(false)
  })
})
