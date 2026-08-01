import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import NumberPropertyField from './fields/NumberPropertyField.vue'
import ReferenceStringPropertyField from './fields/ReferenceStringPropertyField.vue'
import PropertyFieldRenderer from './PropertyFieldRenderer.vue'

describe('PropertyFieldRenderer', () => {
  it('renders the registered field editor selected by its controlled editor id', () => {
    const wrapper = mount(PropertyFieldRenderer, {
      props: {
        editorId: 'field',
        definition: { title: 'Width', fieldType: 'number' },
        value: 10,
      },
    })

    expect(wrapper.findComponent(NumberPropertyField).exists()).toBe(true)
    expect(wrapper.findComponent(ReferenceStringPropertyField).exists()).toBe(false)
  })

  it('renders raw-string without owning a mode toggle', () => {
    const wrapper = mount(PropertyFieldRenderer, {
      props: {
        editorId: 'raw-string',
        appearance: 'embedded',
        definition: {
          title: 'Width',
          fieldType: 'number',
          binding: { provider: () => null },
        },
        value: '{{self:width}}',
      },
    })

    expect(wrapper.classes()).toContain('property-field-renderer--embedded')
    expect(wrapper.findComponent(ReferenceStringPropertyField).exists()).toBe(true)
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('emits value updates without editor-mode side effects', async () => {
    const wrapper = mount(PropertyFieldRenderer, {
      props: {
        editorId: 'field',
        definition: { title: 'Visible', fieldType: 'boolean' },
        value: 'false',
      },
    })

    await wrapper.get('input').setValue(true)
    expect(wrapper.emitted('update:value')).toEqual([['true']])
  })
})
