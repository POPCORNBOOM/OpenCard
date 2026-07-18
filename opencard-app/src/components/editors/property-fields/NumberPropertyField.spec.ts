import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NumberPropertyField from './NumberPropertyField.vue'

describe('NumberPropertyField', () => {
  it('uses themed steppers and clamps values to the schema range', async () => {
    const wrapper = mount(NumberPropertyField, {
      props: {
        definition: { datatype: 'number', min: 0, max: 2 },
        value: 1,
      },
    })

    const steppers = wrapper.findAll('.number-field__stepper')
    expect(steppers).toHaveLength(2)

    await steppers[0].trigger('click')
    await steppers[1].trigger('click')
    expect(wrapper.emitted('update:value')).toEqual([[2], [0]])

    await wrapper.setProps({ value: 2 })
    expect(wrapper.findAll('.number-field__stepper')[0].attributes('disabled')).toBeDefined()
  })
})
