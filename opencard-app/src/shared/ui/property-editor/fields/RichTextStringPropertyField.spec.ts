import { mount } from '@vue/test-utils'
import type { Editor } from '@tiptap/core'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
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
})
