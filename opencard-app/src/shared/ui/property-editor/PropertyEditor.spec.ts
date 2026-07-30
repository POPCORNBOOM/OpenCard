import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import OcButton from '../../../components/base/OcButton.vue'
import PropertyEditor from './PropertyEditor.vue'
import { useFloatingMenu } from '../../../composables/useFloatingMenu'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

describe('PropertyEditor records protocol', () => {
  it('uses the category action definitions for its context menu', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block',
          record: {},
          fields: {
            content: { title: 'Content', fieldType: 'string', defaultValue: '' },
          },
        }],
      },
    })

    await wrapper.get('.property-editor__category-header').trigger('contextmenu')
    const menu = useFloatingMenu()
    expect(menu.state.value.items[0]).toMatchObject({ key: 'add-property' })
    menu.selectMenuItem('add-property:content')
    expect(wrapper.emitted('add-property')).toEqual([[
      { key: 'block', fieldKey: 'content', value: '' },
    ]])
    menu.closeMenu()
  })

  it('copies the stable field key from the field title button', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        deleteMode: false,
        inputs: [{
          key: 'block',
          record: { opacity: 1 },
          fields: {
            opacity: { title: 'Opacity', fieldType: 'number' },
          },
        }],
      },
    })

    const button = wrapper.get('.property-editor__field-key-button')
    expect(button.text()).toBe('Opacity')
    expect(button.attributes('data-tooltip')).toBe('propertyEditor.actions.copyFieldKeyTooltip')
    await button.trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith('opacity')
  })

  it('dispatches explicitly marked strings to the rich-text editor', async () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'text',
          record: { content: '<p>Hello</p>' },
          fields: {
            content: { title: 'Content', fieldType: 'string', richText: true },
          },
        }],
      },
    })

    await vi.dynamicImportSettled()
    await flushPromises()
    await nextTick()
    expect(wrapper.find('.rich-text-string-field__preview').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(false)

    await wrapper.get('.rich-text-string-field__preview').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.rich-text-string-popover')).not.toBeNull()
    wrapper.unmount()
  })

  it('edits array fields by emitting complete arrays and reuses element completion', async () => {
    const completion = vi.fn(() => ({
      replaceStart: 0,
      replaceEnd: 0,
      items: [{ key: 'base', label: 'base.opencardproject', insertText: 'base.opencardproject' }],
    }))
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'project',
          record: { extends: ['base.opencardproject', 'locale.opencardproject'] },
          fields: {
            extends: {
              title: 'Extends',
              fieldType: 'filePath[]',
              defaultValue: [],
              completion: { provider: completion },
            },
          },
        }],
      },
    })

    const items = wrapper.findAll('.array-property-field__item')
    expect(items).toHaveLength(2)
    expect(items[0].get('button[aria-label="Move up"]').attributes('disabled')).toBeDefined()
    expect(items[1].get('button[aria-label="Move down"]').attributes('disabled')).toBeDefined()

    await items[0].get('input').trigger('focus')
    expect(completion).toHaveBeenCalled()

    await items[1].get('button[aria-label="Move up"]').trigger('click')
    const moveEmissions = wrapper.emitted('update-property') ?? []
    expect(moveEmissions[moveEmissions.length - 1]).toEqual([{
      key: 'project',
      fieldKey: 'extends',
      value: ['locale.opencardproject', 'base.opencardproject'],
    }])

    await items[0].get('button[aria-label="Delete item"]').trigger('click')
    const deleteEmissions = wrapper.emitted('update-property') ?? []
    expect(deleteEmissions[deleteEmissions.length - 1]).toEqual([{
      key: 'project',
      fieldKey: 'extends',
      value: ['base.opencardproject'],
    }])
  })

  it('reveals a field by its input and field keys', async () => {
    const wrapper = mount(PropertyEditor, {
      attachTo: document.body,
      props: {
        sortMode: 'category',
        inputs: [{
          key: 'block:1',
          record: { content: '😀 Hello {{self:missing}}!' },
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
      revealField: (
        inputKey: string,
        fieldKey: string,
        characterOffset?: number,
      ) => Promise<boolean>
    }
    expect(await editor.revealField('block:1', 'content', 8)).toBe(true)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
    expect(row.classes()).toContain('is-revealed')
    expect(document.activeElement).toBe(row.get('input').element)
    expect((row.get('input').element as HTMLInputElement).selectionStart).toBe(9)
    expect((row.get('input').element as HTMLInputElement).selectionEnd).toBe(9)
    expect(await editor.revealField('block:1', 'missing')).toBe(false)

    wrapper.unmount()
  })

  it('shows deletable fields only in delete mode and emits on the first click', async () => {
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

    expect(wrapper.find('.delete-field-button').exists()).toBe(false)
    await wrapper.setProps({ deleteMode: true })
    const button = wrapper.get('.delete-field-button')
    expect(button.classes()).not.toContain('is-armed')
    await button.trigger('click')
    expect(wrapper.emitted('delete-property')).toEqual([[
      { key: 'block', fieldKey: 'score' },
    ]])
  })

  it('does not expose delete mode for required fields', () => {
    const wrapper = mount(PropertyEditor, {
      props: {
        sortMode: 'category',
        deleteMode: true,
        inputs: [{
          key: 'block',
          record: { score: 10 },
          fields: {
            score: { title: 'Score', fieldType: 'number' },
          },
        }],
      },
    })

    expect(wrapper.find('.delete-field-button').exists()).toBe(false)
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
    const rawToggle = () => wrapper.findAllComponents(OcButton)
      .find(button => button.classes().includes('raw-string-toggle'))!
    expect(rawToggle().props('icon')).toBe('data.code-string')
    await wrapper.get('button[aria-label="propertyEditor.bindings.useRawEditor"]').trigger('click')
    expect(wrapper.find('.reference-string-field').exists()).toBe(true)
    expect(rawToggle().props('icon')).toBe('data.symbol-number')
    await wrapper.get('.reference-string-field input').setValue('{{self:score}}')
    expect(wrapper.emitted('update-property')).toEqual([[
      { key: 'block', fieldKey: 'opacity', value: '{{self:score}}' },
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
          record: { opacity: '{{self:score}}' },
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
    expect((wrapper.get('.reference-string-field input').element as HTMLInputElement).value).toBe('{{self:score}}')
  })
})
