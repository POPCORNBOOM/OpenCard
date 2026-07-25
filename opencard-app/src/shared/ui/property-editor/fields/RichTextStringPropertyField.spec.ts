import { mount } from '@vue/test-utils'
import type { Editor } from '@tiptap/core'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import OcOptionGroup from '../../../../components/standard/OcOptionGroup.vue'
import OcRichTextEditor from '../../rich-text/OcRichTextEditor.vue'
import RichTextStringPropertyField from './RichTextStringPropertyField.vue'

afterEach(() => {
  document.body.innerHTML = ''
})

describe('RichTextStringPropertyField', () => {
  it('writes a local draft only when the user saves', async () => {
    const wrapper = mount(RichTextStringPropertyField, {
      attachTo: document.body,
      props: {
        definition: { title: 'Content', fieldType: 'string', richText: true },
        value: '<p>Original</p>',
      },
    })

    await wrapper.get('.rich-text-string-field__preview').trigger('click')
    await nextTick()
    let editor = (wrapper.findComponent(OcRichTextEditor).vm as unknown as { editor: Editor }).editor
    editor.commands.setContent('<p>Cancelled</p>', true)

    expect(wrapper.emitted('update:value')).toBeUndefined()
    document.querySelector<HTMLButtonElement>('[aria-label="取消富文本编辑"]')!.click()
    await nextTick()
    expect(wrapper.emitted('update:value')).toBeUndefined()

    await wrapper.get('.rich-text-string-field__preview').trigger('click')
    await nextTick()
    editor = (wrapper.findComponent(OcRichTextEditor).vm as unknown as { editor: Editor }).editor
    editor.commands.setContent('<p>Saved</p>', true)
    document.querySelector<HTMLButtonElement>('[aria-label="保存富文本编辑"]')!.click()
    await nextTick()

    expect(wrapper.emitted('update:value')).toEqual([['<p>Saved</p>']])
    wrapper.unmount()
  })

  it('keeps the rich-text draft open when binding editing consumes Escape', async () => {
    const wrapper = mount(RichTextStringPropertyField, {
      attachTo: document.body,
      props: {
        definition: { title: 'Content', fieldType: 'string', richText: true },
        value: '<p><span data-oc-binding="self:name">{{self:name}}</span></p>',
      },
    })

    await wrapper.get('.rich-text-string-field__preview').trigger('click')
    await nextTick()
    await nextTick()
    const editor = (wrapper.findComponent(OcRichTextEditor).vm as unknown as { editor: Editor }).editor
    editor.view.dom.querySelector<HTMLButtonElement>('[aria-label="编辑 binding"]')!.click()
    await nextTick()

    const input = editor.view.dom.querySelector<HTMLInputElement>('.binding-node__input')!
    input.value = 'project:name'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise(resolve => window.setTimeout(resolve, 0))

    expect(document.querySelector('[aria-label="富文本编辑器"]')).not.toBeNull()
    expect(editor.getHTML()).toContain('data-oc-binding="self:name"')
    expect(wrapper.emitted('update:value')).toBeUndefined()
    wrapper.unmount()
  })

  it('edits sanitized HTML source inside the same draft transaction', async () => {
    const wrapper = mount(RichTextStringPropertyField, {
      attachTo: document.body,
      props: {
        definition: { title: 'Content', fieldType: 'string', richText: true },
        value: '<p>Original</p>',
      },
    })

    await wrapper.get('.rich-text-string-field__preview').trigger('click')
    await nextTick()
    expect(wrapper.getComponent(OcOptionGroup).props('options')).toEqual([
      { value: 'rich', label: '富文本', icon: 'format.text-variant-outline' },
      { value: 'source', label: 'HTML 源码', icon: 'format.xml' },
    ])
    expect(wrapper.getComponent(OcOptionGroup).props('appearance')).toBe('sliding-outline')

    document.querySelector<HTMLButtonElement>('[role="radio"][aria-label="HTML 源码"]')!.click()
    await nextTick()
    const source = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="HTML 源码"]')!
    source.value = '<p><strong>Edited</strong><script>bad</script><span data-oc-binding="self:name">{{self:name}}</span></p>'
    source.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(wrapper.emitted('update:value')).toBeUndefined()

    document.querySelector<HTMLButtonElement>('[role="radio"][aria-label="富文本"]')!.click()
    await nextTick()
    await nextTick()
    const editor = (wrapper.findComponent(OcRichTextEditor).vm as unknown as { editor: Editor }).editor
    expect(editor.getHTML()).toBe('<p><strong>Edited</strong><span data-oc-binding="self:name">{{self:name}}</span></p>')

    document.querySelector<HTMLButtonElement>('[role="radio"][aria-label="HTML 源码"]')!.click()
    await nextTick()
    document.querySelector<HTMLButtonElement>('[aria-label="保存富文本编辑"]')!.click()
    await nextTick()
    expect(wrapper.emitted('update:value')).toEqual([[
      '<p><strong>Edited</strong><span data-oc-binding="self:name">{{self:name}}</span></p>',
    ]])
    wrapper.unmount()
  })

  it('formats rich-text blocks when opening the source view', async () => {
    const wrapper = mount(RichTextStringPropertyField, {
      attachTo: document.body,
      props: {
        definition: { title: 'Content', fieldType: 'string', richText: true },
        value: '<p>First</p><p><strong>Second</strong></p>',
      },
    })

    await wrapper.get('.rich-text-string-field__preview').trigger('click')
    await nextTick()
    document.querySelector<HTMLButtonElement>('[role="radio"][aria-label="HTML 源码"]')!.click()
    await nextTick()

    expect(document.querySelector<HTMLTextAreaElement>('textarea[aria-label="HTML 源码"]')!.value)
      .toBe('<p>First</p>\n<p><strong>Second</strong></p>')
    wrapper.unmount()
  })
})
