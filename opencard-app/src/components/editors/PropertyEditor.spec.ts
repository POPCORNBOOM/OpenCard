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
  it('requires two clicks before emitting a generic delete intent', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { score: 10 },
          fields: {
            score: { title: 'Score', datatype: 'number', deletable: true },
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
            score: { title: 'Score', datatype: 'number', deletable: true },
          },
        }],
      },
    })

    const button = wrapper.get('.delete-field-button')
    await button.trigger('click')
    await wrapper.get('.property-editor__source-header').trigger('pointerdown')
    expect(button.classes()).not.toContain('is-armed')
  })

  it('replaces a bound number editor and clears to the datatype default', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: { opacity: '{{s:score}}' },
          fields: {
            opacity: {
              title: 'Opacity',
              datatype: 'number',
              defaultValue: 1,
              completion: { provider: () => null },
            },
          },
        }],
      },
    })

    expect(wrapper.find('input[type="number"]').exists()).toBe(false)
    await wrapper.get('button[aria-label="propertyEditor.bindings.clear"]').trigger('click')
    expect(wrapper.emitted('update-property')).toEqual([[
      { key: 'block', fieldKey: 'opacity', value: 1 },
    ]])
  })
})
