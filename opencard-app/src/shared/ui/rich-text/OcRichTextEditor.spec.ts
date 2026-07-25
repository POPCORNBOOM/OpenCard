import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import OcRichTextEditor from './OcRichTextEditor.vue'

describe('OcRichTextEditor', () => {
  it('serializes selection formatting as controlled HTML', () => {
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p>Hello</p>' },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor

    editor.chain()
      .setTextSelection({ from: 1, to: 6 })
      .toggleBold()
      .toggleItalic()
      .setColor('#ff0000')
      .setHighlight({ color: '#ffff00' })
      .setFontFamily('Impact')
      .setMark('textStyle', { textStrokeColor: '#000000', textStrokeWidth: '1px' })
      .setTextAlign('center')
      .run()

    const html = editor.getHTML()
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
    expect(html).toContain('color: rgb(255, 0, 0)')
    expect(html).toContain('background-color: rgb(255, 255, 0)')
    expect(html).toContain('font-family: Impact')
    expect(html).toContain('-webkit-text-stroke-color: rgb(0, 0, 0)')
    expect(html).toContain('-webkit-text-stroke-width: 1px')
    expect(html).toContain('text-align: center')

    wrapper.unmount()
  })

  it('preserves the selection when the parent echoes an editor update', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p>Hello</p>' },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor

    editor.chain()
      .setTextSelection({ from: 1, to: 6 })
      .setHighlight({ color: '#ffff00' })
      .run()

    const updates = wrapper.emitted('update:modelValue') ?? []
    const echoedValue = updates[updates.length - 1]?.[0] as string
    await wrapper.setProps({ modelValue: echoedValue })

    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(6)

    await wrapper.setProps({ modelValue: '<p>External</p>' })
    expect(editor.getText()).toBe('External')
    wrapper.unmount()
  })

  it('keeps a binding atomic while applying marks to its rendered value', () => {
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p>Score: <span data-oc-binding="self:score">{{self:score}}</span></p>',
      },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    let bindingPosition = -1
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'binding') bindingPosition = position
    })

    expect(bindingPosition).toBeGreaterThan(0)
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, bindingPosition)))
    editor.chain().setColor('#ff0000').toggleBold().run()

    const binding = editor.state.doc.nodeAt(bindingPosition)
    expect(binding?.isAtom).toBe(true)
    expect(binding?.attrs.expression).toBe('self:score')
    expect(binding?.marks.map(mark => mark.type.name)).toEqual(expect.arrayContaining(['bold', 'textStyle']))
    const documentNode = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
    const serializedBinding = documentNode.querySelector('[data-oc-binding="self:score"]')
    expect(serializedBinding?.hasAttribute('expression')).toBe(false)
    expect(serializedBinding?.closest('strong')).not.toBeNull()
    expect(serializedBinding?.closest('[style*="color"]')).not.toBeNull()
    expect(editor.getText()).toContain('{{self:score}}')

    const serializedHtml = editor.getHTML()
    editor.commands.setContent(serializedHtml, false)
    let pastedBindingCount = 0
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'binding') pastedBindingCount += 1
    })
    expect(pastedBindingCount).toBe(1)

    wrapper.unmount()
  })

  it('reuses property binding completion inside a new capsule', async () => {
    const completion = vi.fn(({ value }: { value: string; cursor: number }) => (
      value === '{{pro}}'
        ? {
            replaceStart: 2,
            replaceEnd: 5,
            items: [{
              key: 'field:project:name',
              label: 'Name',
              insertText: 'project:name',
            }],
          }
        : null
    ))
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p></p>',
        bindingCompletion: completion,
      },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor

    await nextTick()
    await wrapper.get('button[title="插入 binding"]').trigger('click')
    await nextTick()
    await nextTick()
    const input = editor.view.dom.querySelector<HTMLInputElement>('.binding-node__input')!
    input.value = 'pro'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await vi.waitFor(() => expect(completion).toHaveBeenCalledWith({ value: '{{pro}}', cursor: 5 }))
    await nextTick()
    expect(document.querySelector<HTMLElement>('.oc-autocomplete-popover')?.style.zIndex).toBe('2500')
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()

    expect(editor.getHTML()).toContain('data-oc-binding="project:name"')
    wrapper.unmount()
  })

  it('edits and removes a complete binding capsule', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p><span data-oc-binding="self:name">{{self:name}}</span></p>' },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor

    await nextTick()
    await nextTick()
    const label = editor.view.dom.querySelector<HTMLElement>('.binding-node__label')!
    label.click()
    await nextTick()
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect(editor.view.dom.querySelector('.binding-node')?.classList.contains('is-selected')).toBe(true)

    editor.view.dom.querySelector<HTMLButtonElement>('[aria-label="编辑 binding"]')!.click()
    await nextTick()

    const input = editor.view.dom.querySelector<HTMLInputElement>('.binding-node__input')!
    input.value = 'project:name'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()

    expect(editor.getHTML()).toContain('data-oc-binding="project:name"')
    expect(editor.getHTML()).toContain('{{project:name}}')

    editor.view.dom.querySelector<HTMLButtonElement>('[aria-label="删除 binding"]')!.click()
    expect(editor.state.doc.firstChild?.childCount).toBe(0)
    wrapper.unmount()
  })
})
