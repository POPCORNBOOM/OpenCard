import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StringPropertyField from './StringPropertyField.vue'

describe('StringPropertyField', () => {
  it('renders schema options and emits the selected value', async () => {
    const wrapper = mount(StringPropertyField, {
      props: {
        definition: {
          datatype: 'string',
          options: ['cover', 'contain', 'fill'],
        },
        value: 'contain',
      },
    })

    const select = wrapper.get('select')
    expect(select.findAll('option').map((option) => option.text())).toEqual([
      'cover',
      'contain',
      'fill',
    ])

    await select.setValue('fill')
    expect(wrapper.emitted('update:value')).toEqual([['fill']])
  })

  it('renders an independently scrolling textarea when multiline is enabled', async () => {
    const wrapper = mount(StringPropertyField, {
      props: {
        definition: { datatype: 'string', multiline: true },
        value: 'first line\nsecond line',
      },
    })

    const textarea = wrapper.get('textarea')
    expect(wrapper.get('.multiline-field').classes()).toContain('multiline-field')
    expect((textarea.element as HTMLTextAreaElement).value).toBe('first line\nsecond line')

    await textarea.setValue('updated\ncontent')
    expect(wrapper.emitted('update:value')).toEqual([['updated\ncontent']])
  })
})
