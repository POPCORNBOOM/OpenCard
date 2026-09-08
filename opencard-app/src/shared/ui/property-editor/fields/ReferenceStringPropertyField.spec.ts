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

  it('uses Shift+Tab for provider parent navigation without consuming it at the root', async () => {
    const wrapper = mount(ReferenceStringPropertyField, {
      props: {
        definition: {
          title: 'Reference',
          fieldType: 'string',
          completion: {
            static: { values: ['scope:'] },
            provider: ({ value }) => value === 'scope:'
              ? {
                  replaceStart: 0,
                  replaceEnd: value.length,
                  items: [{ key: 'leaf', label: 'Leaf', insertText: 'scope:leaf' }],
                  parent: { key: 'parent', label: '..', insertText: '', keepOpen: true },
                }
              : {
                  replaceStart: 0,
                  replaceEnd: value.length,
                  items: [{ key: 'scope', label: 'Scope', insertText: 'scope:', keepOpen: true }],
                },
          },
        },
        value: 'scope:',
      },
    })
    const input = wrapper.get('input')
    const control = input.element as HTMLInputElement
    await input.trigger('focus')
    await nextTick()

    const parentEvent = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    })
    control.dispatchEvent(parentEvent)
    await nextTick()
    await nextTick()
    expect(parentEvent.defaultPrevented).toBe(true)
    expect(control.value).toBe('')

    control.value = 'sc'
    control.setSelectionRange(control.value.length, control.value.length)
    await input.trigger('input')
    await nextTick()
    const rootEvent = new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    })
    control.dispatchEvent(rootEvent)
    expect(rootEvent.defaultPrevented).toBe(false)
    expect(control.value).toBe('sc')

    control.value = 'scope:'
    control.setSelectionRange(control.value.length, control.value.length)
    await input.trigger('input')
    await nextTick()
    await input.trigger('keydown', { key: 'ArrowUp' })
    await input.trigger('keydown', { key: 'Enter' })
    await nextTick()
    expect(control.value).toBe('')
  })

  it.each([false, true])('projects readonly onto the native control when multiline=%s', (multiline) => {
    const wrapper = mount(ReferenceStringPropertyField, {
      props: {
        definition: {
          title: 'Readonly',
          fieldType: 'string',
          isReadonly: true,
          multiline,
        },
        value: 'Locked',
      },
    })

    expect(wrapper.get(multiline ? 'textarea' : 'input').attributes('readonly')).toBeDefined()
  })
})
