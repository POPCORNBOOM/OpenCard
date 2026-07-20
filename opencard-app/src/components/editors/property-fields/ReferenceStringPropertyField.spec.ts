import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import ReferenceStringPropertyField from './ReferenceStringPropertyField.vue'

describe('ReferenceStringPropertyField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('pairs braces and accepts scope and field suggestions with Tab', async () => {
    const wrapper = mount(ReferenceStringPropertyField, {
      props: {
        definition: {
          datatype: 'string',
        },
        value: '',
        referenceContext: {
          targetKind: 'string',
          scopes: [{
            token: 'c',
            label: '当前卡片',
            fields: [{ key: 'name', valueKind: 'string' }],
          }],
        },
      },
    })
    const input = wrapper.get('input')
    const element = input.element as HTMLInputElement

    element.value = '{{'
    element.setSelectionRange(2, 2)
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: '{',
      inputType: 'insertText',
    }))
    await nextTick()

    expect(wrapper.emitted('update:value')?.slice(-1)[0]).toEqual(['{{}}'])
    expect(Array.from(document.body.querySelectorAll('[role="option"]')).map((item) => item.textContent)).toEqual([
      'c:当前卡片',
    ])

    await input.trigger('keydown', { key: 'Tab' })
    await nextTick()
    expect(wrapper.emitted('update:value')?.slice(-1)[0]).toEqual(['{{c:}}'])

    await input.trigger('keydown', { key: 'Tab' })
    await nextTick()
    expect(wrapper.emitted('update:value')?.slice(-1)[0]).toEqual(['{{c:name}}'])
  })

  it('refreshes completion after keyboard cursor movement', async () => {
    const wrapper = mount(ReferenceStringPropertyField, {
      props: {
        definition: { datatype: 'string' },
        value: 'Value {{c:na}}',
        referenceContext: {
          targetKind: 'string',
          scopes: [{
            token: 'c',
            label: 'Current card',
            fields: [{ key: 'name', valueKind: 'string' }],
          }],
        },
      },
    })
    const input = wrapper.get('input')
    const element = input.element as HTMLInputElement
    await input.trigger('focus')
    element.setSelectionRange(12, 12)
    await input.trigger('keyup', { key: 'ArrowLeft' })

    expect(Array.from(document.body.querySelectorAll('[role="option"]')).map((item) => item.textContent))
      .toEqual(['nameCurrent card'])
  })
})
