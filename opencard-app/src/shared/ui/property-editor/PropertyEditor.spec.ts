import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import PropertyEditor from './PropertyEditor.vue'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

describe('PropertyEditor records protocol', () => {
  it('reveals a field by its input and field keys', async () => {
    const wrapper = mount(PropertyEditor, {
      attachTo: document.body,
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block:1',
          record: { content: 'Hello' },
          fields: {
            content: { title: 'Content', fieldType: 'string' },
          },
        }],
      },
    })

    const row = wrapper.get('.property-editor__row')
    const scrollIntoView = vi.fn()
    Object.defineProperty(row.element, 'scrollIntoView', { value: scrollIntoView })

    const editor = wrapper.vm as unknown as {
      revealField: (inputKey: string, fieldKey: string) => Promise<boolean>
    }
    expect(await editor.revealField('block:1', 'content')).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(row.classes()).toContain('is-revealed')
    expect(document.activeElement).toBe(row.get('input').element)
    expect(await editor.revealField('block:1', 'missing')).toBe(false)

    wrapper.unmount()
  })

  it('requires two clicks before emitting a generic delete intent', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { score: 10 },
          fields: {
            score: { title: 'Score', fieldType: 'number', deletable: true },
          },
        }],
      },
    })

    const button = wrapper.get('.delete-field-button')
    await button.trigger('click')
    expect(wrapper.emitted('delete-property')).toBeUndefined()
    expect(button.classes()).toContain('is-armed')

    await button.trigger('click')
    expect(wrapper.emitted('delete-property')).toEqual([[
      { key: 'block', fieldKey: 'score' },
    ]])
  })

  it('cancels an armed delete when another editor area is clicked', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { score: 10 },
          fields: {
            score: { title: 'Score', fieldType: 'number', deletable: true },
          },
        }],
      },
    })

    const button = wrapper.get('.delete-field-button')
    await button.trigger('click')
    await wrapper.get('.property-editor__source-header').trigger('pointerdown')
    expect(button.classes()).not.toContain('is-armed')
  })

  it('switches a bindable number field to the raw string editor', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        bindingInterpreter: {
          isExpression: (value) => typeof value === 'string' && value.startsWith('{{'),
        },
        inputs: [{
          key: 'block',
          record: { opacity: '1' },
          fields: {
            opacity: {
              title: 'Opacity',
              fieldType: 'number',
              defaultValue: '1',
              binding: { provider: () => null },
            },
          },
        }],
      },
    })

    expect(wrapper.find('.reference-string-field').exists()).toBe(false)
    await wrapper.get('button[aria-label="propertyEditor.bindings.useRawEditor"]').trigger('click')
    expect(wrapper.find('.reference-string-field').exists()).toBe(true)
    await wrapper.get('.reference-string-field input').setValue('{{s:score}}')
    expect(wrapper.emitted('update-property')).toEqual([[
      { key: 'block', fieldKey: 'opacity', value: '{{s:score}}' },
    ]])
  })

  it('shows an existing binding in the raw string editor without the legacy binding field', () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        bindingInterpreter: {
          isExpression: (value) => typeof value === 'string' && value.startsWith('{{'),
        },
        inputs: [{
          key: 'block',
          record: { opacity: '{{s:score}}' },
          fields: {
            opacity: {
              title: 'Opacity',
              fieldType: 'number',
              defaultValue: '1',
              binding: { provider: () => null },
            },
          },
        }],
      },
    })

    expect(wrapper.find('.reference-string-field').exists()).toBe(true)
    expect(wrapper.find('.binding-property-field').exists()).toBe(false)
    expect((wrapper.get('.reference-string-field input').element as HTMLInputElement).value).toBe('{{s:score}}')
  })
})
