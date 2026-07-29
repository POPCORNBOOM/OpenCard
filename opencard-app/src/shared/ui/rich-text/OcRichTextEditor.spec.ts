import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcColorPicker from '../../../components/standard/OcColorPicker.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import OcRichTextEditor from './OcRichTextEditor.vue'

describe('OcRichTextEditor', () => {
  it('preserves consecutive spaces when parsing initial and external HTML', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p>Left   right</p>' },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor

    expect(editor.getHTML()).toBe('<p>Left   right</p>')
    await wrapper.setProps({ modelValue: '<p>Next    value</p>' })
    expect(editor.getHTML()).toBe('<p>Next    value</p>')
    wrapper.unmount()
  })

  it('serializes selection formatting as controlled HTML', () => {
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p>Hello</p>' },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor

    editor.chain()
      .setTextSelection({ from: 1, to: 6 })
      .toggleBold()
      .toggleItalic()
      .toggleUnderline()
      .toggleStrike()
      .setColor('#ff0000')
      .setHighlight({ color: '#ffff00' })
      .setFontFamily('Impact')
      .setMark('textStyle', {
        fontSize: '18px',
        textStrokeColor: '#000000',
        textStrokeWidth: '1px',
      })
      .setTextAlign('center')
      .run()

    const html = editor.getHTML()
    expect(html).toContain('<strong>')
    expect(html).toContain('<em>')
    expect(html).toContain('<u>')
    expect(html).toContain('<s>')
    expect(html).toContain('color: rgb(255, 0, 0)')
    expect(html).toContain('background-color: rgb(255, 255, 0)')
    expect(html).toContain('font-family: Impact')
    expect(html).toContain('font-size: 18px')
    expect(html).toContain('-webkit-text-stroke-color: rgb(0, 0, 0)')
    expect(html).toContain('-webkit-text-stroke-width: 1px')
    expect(html).toContain('text-align: center')

    wrapper.unmount()
  })

  it('maps project font references to CSS-safe rich-text values', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p>Hello</p>',
        fontOptions: [{
          label: 'Brand Sans',
          value: 'project:brand-sans',
          cssFamily: '"OpenCardProjectFont-brand-sans"',
        }],
        baseStyle: { fontSize: '32px' },
      },
    })
    await nextTick()
    await nextTick()
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    editor.commands.setTextSelection({ from: 1, to: 6 })

    wrapper.getComponent(OcSelect).vm.$emit('update:modelValue', 'project:brand-sans')
    await nextTick()

    expect(editor.getHTML()).toContain('font-family: &quot;OpenCardProjectFont-brand-sans&quot;')
    expect(wrapper.getComponent(OcSelect).props('modelValue')).toBe('project:brand-sans')
    expect(wrapper.findAllComponents(OcSelect)[1]?.props('modelValue')).toBe('32')
    editor.chain().selectAll().setMark('textStyle', { fontSize: '37px' }).run()
    await nextTick()
    expect(wrapper.findAllComponents(OcSelect)[1]?.props('options'))
      .toContainEqual({ label: '37 px', value: '37' })
    await wrapper.get('button[data-tooltip="增大字号"]').trigger('click')
    expect(editor.getHTML()).toContain('font-family: &quot;OpenCardProjectFont-brand-sans&quot;')
    expect(editor.getHTML()).toContain('font-size: 40px')
    wrapper.unmount()
  })

  it('uses semantic icons and changes font size by stable steps', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p>Hello</p>',
        bindingCompletion: () => null,
      },
    })
    await nextTick()
    await nextTick()
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    const iconNames = wrapper.findAllComponents(OcIcon).map(icon => icon.props('name'))
    expect(iconNames).toEqual(expect.arrayContaining([
      'format.code-braces',
      'format.bold',
      'format.italic',
      'format.underline',
      'format.strikethrough',
      'format.color-fill',
      'format.color-highlight',
      'format.clear',
      'format.font-size-increase',
      'format.font-size-decrease',
    ]))

    editor.commands.setTextSelection({ from: 1, to: 6 })
    await wrapper.get('button[data-tooltip="下划线"]').trigger('click')
    await wrapper.get('button[data-tooltip="删除线"]').trigger('click')
    expect(editor.getHTML()).toContain('<u>')
    expect(editor.getHTML()).toContain('<s>')
    await wrapper.get('button[data-tooltip="增大字号"]').trigger('click')
    expect(editor.getHTML()).toContain('font-size: 18px')
    await wrapper.get('button[data-tooltip="减小字号"]').trigger('click')
    expect(editor.getHTML()).toContain('font-size: 16px')
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

  it('restores an absent color mark when a picker preview is cancelled', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p>Hello</p>' },
    })
    await nextTick()
    await nextTick()
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    editor.commands.setTextSelection({ from: 1, to: 6 })
    const backgroundPicker = wrapper.findAllComponents(OcColorPicker)[1]!

    backgroundPicker.vm.$emit('open-change', true)
    backgroundPicker.vm.$emit('preview', '#ff0000')
    await nextTick()
    expect(editor.getHTML()).toContain('background-color: rgb(255, 0, 0)')

    backgroundPicker.vm.$emit('cancel')
    await nextTick()
    expect(editor.getHTML()).toBe('<p>Hello</p>')
    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(6)
    wrapper.unmount()
  })

  it('keeps a binding atomic while applying marks to its rendered value', async () => {
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
    editor.chain().setColor('#ff0000').setHighlight({ color: '#ffff00' }).toggleBold().run()
    await nextTick()
    await nextTick()

    const binding = editor.state.doc.nodeAt(bindingPosition)
    expect(binding?.isAtom).toBe(true)
    expect(binding?.attrs.expression).toBe('self:score')
    expect(binding?.marks.map(mark => mark.type.name)).toEqual(expect.arrayContaining(['bold', 'highlight', 'textStyle']))
    const documentNode = new DOMParser().parseFromString(editor.getHTML(), 'text/html')
    const serializedBinding = documentNode.querySelector('[data-oc-binding="self:score"]')
    expect(serializedBinding?.hasAttribute('expression')).toBe(false)
    expect(serializedBinding?.closest('strong')).not.toBeNull()
    expect(serializedBinding?.closest('[style*="color"]')).not.toBeNull()
    expect(editor.view.dom.querySelector<HTMLElement>('.binding-node__expression')?.style.backgroundColor)
      .toBe('rgb(255, 255, 0)')
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
    await wrapper.get('button[data-tooltip="插入 binding"]').trigger('click')
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

    let input = editor.view.dom.querySelector<HTMLInputElement>('.binding-node__input')!
    input.value = 'project:name'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await new Promise(resolve => window.setTimeout(resolve, 0))

    expect(editor.getHTML()).toContain('data-oc-binding="self:name"')
    expect(editor.view.dom.querySelector('.binding-node__input')).toBeNull()

    editor.view.dom.querySelector<HTMLButtonElement>('[aria-label="编辑 binding"]')!.click()
    await nextTick()
    input = editor.view.dom.querySelector<HTMLInputElement>('.binding-node__input')!
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
