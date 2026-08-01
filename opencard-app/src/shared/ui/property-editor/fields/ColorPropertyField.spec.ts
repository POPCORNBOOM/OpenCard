import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcColorPicker from '../../../../components/standard/OcColorPicker.vue'
import ColorPropertyField from './ColorPropertyField.vue'

describe('ColorPropertyField', () => {
  it('uses the standard contrast-safe color field and commits edited values', async () => {
    const wrapper = mount(ColorPropertyField, {
      props: {
        definition: { title: 'Color', fieldType: 'color' },
        value: '#112233',
      },
    })

    expect(wrapper.find('input[type="color"]').exists()).toBe(false)
    expect(wrapper.getComponent(OcColorPicker).props('allowAlpha')).toBe(true)
    expect(wrapper.get('.oc-color-picker__field').attributes('style'))
      .toContain('background-color: rgb(17, 34, 51)')
    expect(wrapper.get('.oc-color-picker__field-trigger').attributes('aria-label')).toBe('Color')
    const textInput = wrapper.get('.oc-color-picker__field-input')
    expect((textInput.element as HTMLInputElement).value).toBe('#112233')

    await textInput.setValue('#445566')
    expect(wrapper.emitted('update:value')).toBeUndefined()
    await textInput.trigger('blur')
    const updates = wrapper.emitted('update:value') ?? []
    expect(updates[updates.length - 1]).toEqual(['#445566'])
  })

  it('disables both color entry points for readonly fields', () => {
    const wrapper = mount(ColorPropertyField, {
      props: {
        definition: { title: 'Color', fieldType: 'color', isReadonly: true },
        value: '#112233',
      },
    })

    expect(wrapper.get('.oc-color-picker__field-trigger').attributes()).toHaveProperty('disabled')
    expect(wrapper.get('.oc-color-picker__field-input').attributes()).toHaveProperty('disabled')
  })
})
