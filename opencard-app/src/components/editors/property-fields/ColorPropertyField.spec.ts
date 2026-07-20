import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ColorPropertyField from './ColorPropertyField.vue'

describe('ColorPropertyField', () => {
  it('keeps the swatch and editable value in one field', async () => {
    const wrapper = mount(ColorPropertyField, {
      props: {
        definition: { fieldType: 'color' },
        value: '#112233',
      },
    })

    expect((wrapper.get('input[type="color"]').element as HTMLInputElement).value).toBe('#112233')
    const textInput = wrapper.get('.oc-field-input')
    expect((textInput.element as HTMLInputElement).value).toBe('#112233')

    await textInput.setValue('#445566')
    const updates = wrapper.emitted('update:value') ?? []
    expect(updates[updates.length - 1]).toEqual(['#445566'])
  })
})
