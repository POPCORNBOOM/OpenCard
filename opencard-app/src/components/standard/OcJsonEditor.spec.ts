import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcJsonEditor from './OcJsonEditor.vue'

describe('OcJsonEditor', () => {
  it('formats input value and emits parsed JSON objects', async () => {
    const wrapper = mount(OcJsonEditor, {
      props: {
        modelValue: {
          name: 'OpenCard',
          enabled: true,
        },
      },
    })

    const textarea = wrapper.get('textarea')
    const initialValue = (textarea.element as HTMLTextAreaElement).value

    expect(initialValue).toContain('"name": "OpenCard"')
    expect(initialValue).toContain('"enabled": true')

    await textarea.setValue('{\n  "name": "Sample",\n  "enabled": false\n}')

    const payloads = wrapper.emitted('update:modelValue')
    expect(payloads).toBeTruthy()
    expect(payloads?.[payloads.length - 1]?.[0]).toEqual({
      name: 'Sample',
      enabled: false,
    })
  })

  it('keeps invalid drafts visible and shows a validation error', async () => {
    const wrapper = mount(OcJsonEditor, {
      props: {
        modelValue: {
          name: 'OpenCard',
        },
      },
    })

    await wrapper.get('textarea').setValue('{')

    expect(wrapper.text()).toContain('Invalid JSON')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('uses semantic height modes', () => {
    const wrapper = mount(OcJsonEditor, {
      props: { modelValue: [], heightMode: 'array' },
    })

    expect(wrapper.get('textarea').classes()).toContain('oc-json-editor__input--array')
    expect(wrapper.get('textarea').attributes('style')).toBeUndefined()
  })
})
