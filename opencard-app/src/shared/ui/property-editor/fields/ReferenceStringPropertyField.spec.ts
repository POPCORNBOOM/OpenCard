import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import ReferenceStringPropertyField from './ReferenceStringPropertyField.vue'

describe('ReferenceStringPropertyField', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('executes prepared auto-pairs and completion providers', async () => {
    const wrapper = mount(ReferenceStringPropertyField, {
      props: {
        definition: {
          title: 'Content',
          fieldType: 'string',
          autoPairs: [{ open: '{{', close: '}}' }],
          completion: {
            provider: ({ value, cursor }) => value === '{{}}' && cursor === 2
              ? {
                  replaceStart: 2,
                  replaceEnd: 2,
                  items: [{ key: 'scope:card', label: 'card:', insertText: 'card:', keepOpen: true }],
                }
              : {
                  replaceStart: 2,
                  replaceEnd: 7,
                  items: [{ key: 'field:card:name', label: 'Name', insertText: 'card:name' }],
                },
          },
        },
        value: '',
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
    await nextTick()

    expect(wrapper.emitted('update:value')?.slice(-1)[0]).toEqual(['{{}}'])
    expect(document.body.querySelector('[role="option"]')?.textContent).toContain('card:')

    await input.trigger('keydown', { key: 'Tab' })
    await nextTick()
    await nextTick()
    expect(wrapper.emitted('update:value')?.slice(-1)[0]).toEqual(['{{card:}}'])
    expect(document.body.querySelector('[role="option"]')?.textContent).toContain('Name')

    await input.trigger('keydown', { key: 'Tab' })
    await nextTick()
    expect(wrapper.emitted('update:value')?.slice(-1)[0]).toEqual(['{{card:name}}'])
  })

  it('refreshes the provider after keyboard cursor movement', async () => {
    let requestedCursor = -1
    const wrapper = mount(ReferenceStringPropertyField, {
      props: {
        definition: {
          title: 'Content',
          fieldType: 'string',
          completion: {
            provider: ({ cursor }) => {
              requestedCursor = cursor
              return null
            },
          },
        },
        value: 'Value {{card:na}}',
      },
    })
    const input = wrapper.get('input')
    const element = input.element as HTMLInputElement
    await input.trigger('focus')
    element.setSelectionRange(12, 12)
    await input.trigger('keyup', { key: 'ArrowLeft' })
    await nextTick()

    expect(requestedCursor).toBe(12)
  })
})
