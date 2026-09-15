import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import OcEnumStepper from './OcEnumStepper.vue'

const options = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
]

function field(wrapper: ReturnType<typeof mount>): HTMLInputElement {
  return wrapper.get('input').element as HTMLInputElement
}

describe('OcEnumStepper', () => {
  it('shows the current option label in a readonly field between two arrows', () => {
    const wrapper = mount(OcEnumStepper, { props: { modelValue: 'center', options } })

    const frame = wrapper.get('.oc-field-frame')
    expect(frame.classes()).toContain('oc-field-frame--full-width')
    expect(frame.classes()).toContain('oc-field-frame--readonly')
    expect(field(wrapper).value).toBe('Center')
    expect(wrapper.get('input').attributes('readonly')).toBeDefined()

    const buttons = wrapper.findAll('button')
    expect(buttons.map(button => button.attributes('aria-label'))).toEqual(['Previous option', 'Next option'])
    expect(buttons.map(button => button.attributes('data-tooltip'))).toEqual(['Previous option', 'Next option'])
    expect(buttons.every(button => button.attributes('disabled') === undefined)).toBe(true)
  })

  it('steps to the neighbouring options without mutating its own value', async () => {
    const wrapper = mount(OcEnumStepper, {
      props: { modelValue: 'center', options, previousLabel: 'Previous alignment', nextLabel: 'Next alignment' },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.map(button => button.attributes('aria-label')))
      .toEqual(['Previous alignment', 'Next alignment'])

    await buttons[1].trigger('click')
    await buttons[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['right'], ['left']])
    expect(field(wrapper).value).toBe('Center')
  })

  it('disables the arrows at the ends of the option list', async () => {
    const wrapper = mount(OcEnumStepper, { props: { modelValue: 'left', options } })

    expect(wrapper.findAll('button')[0].attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeUndefined()

    wrapper.findAll('button')[0].element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    await wrapper.setProps({ modelValue: 'right' })
    expect(wrapper.findAll('button')[0].attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('button')[1].attributes('disabled')).toBeDefined()

    wrapper.findAll('button')[1].element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('steps with the arrow keys inside the field and prevents the default scrolling', async () => {
    const wrapper = mount(OcEnumStepper, { props: { modelValue: 'center', options } })

    const right = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    wrapper.get('input').element.dispatchEvent(right)
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toEqual([['right']])
    expect(right.defaultPrevented).toBe(true)

    const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })
    wrapper.get('input').element.dispatchEvent(left)
    await nextTick()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(updates[updates.length - 1]).toEqual(['left'])
    expect(left.defaultPrevented).toBe(true)
  })

  it('blocks both arrows and keyboard stepping while disabled', async () => {
    const wrapper = mount(OcEnumStepper, { props: { modelValue: 'center', options, disabled: true } })

    const frame = wrapper.get('.oc-field-frame')
    expect(frame.classes()).toContain('oc-field-frame--disabled')
    expect(frame.attributes('aria-disabled')).toBe('true')

    const buttons = wrapper.findAll('button')
    expect(buttons.every(button => button.attributes('disabled') !== undefined)).toBe(true)

    for (const button of buttons) {
      button.element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
    wrapper.get('input').element.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    )
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('shows an empty field and disables both arrows when the value is not among the options', () => {
    const wrapper = mount(OcEnumStepper, { props: { modelValue: 'missing', options } })

    expect(field(wrapper).value).toBe('')
    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('follows the parent model value', async () => {
    const wrapper = mount(OcEnumStepper, { props: { modelValue: 'left', options } })

    await wrapper.setProps({ modelValue: 'right' })

    expect(field(wrapper).value).toBe('Right')
  })
})
