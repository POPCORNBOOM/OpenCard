import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StringPropertyField from './StringPropertyField.vue'

describe('StringPropertyField static completion', () => {
  it('shows a prepared ghost suffix and accepts it with Tab', async () => {
    const wrapper = mount(StringPropertyField, {
      props: {
        value: '12p',
        definition: {
          title: 'Width',
          fieldType: 'string',
          completion: {
            static: { values: ['px', '%'], presentation: 'ghost' },
          },
        },
      },
    })

    expect(wrapper.get('.autocomplete-ghost').text()).toContain('x')
    await wrapper.get('input').trigger('keydown', { key: 'Tab' })
    expect(wrapper.emitted('update:value')).toEqual([['12px']])
  })
})
