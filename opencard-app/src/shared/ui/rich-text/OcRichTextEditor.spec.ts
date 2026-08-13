import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { Editor } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import { Fragment, Slice } from '@tiptap/pm/model'
import { remapPastedEmbedIds } from './customBlockNode'
import OcIcon from '../../../components/base/OcIcon.vue'
import OcColorPicker from '../../../components/standard/OcColorPicker.vue'
import OcSelect from '../../../components/standard/OcSelect.vue'
import OcActionButton, { type OcActionButtonAction } from '../../../components/standard/OcActionButton.vue'
import PropertyEditor from '../property-editor/PropertyEditor.vue'
import PropertyFieldActionRail from '../property-editor/PropertyFieldActionRail.vue'
import PropertyFieldRenderer from '../property-editor/PropertyFieldRenderer.vue'
import { createProjectIconCompletionProvider } from '../../../features/workspace/services/projectIconCompletion'
import OcRichTextEditor from './OcRichTextEditor.vue'
import { clearRecentProjectIcons } from './recentProjectIcons'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    te: () => false,
  }),
}))

describe('OcRichTextEditor', () => {
  it('round-trips unresolved style bindings without CSSOM loss', async () => {
    const source = '<p><mark style="background-color: {{parent.color}}; color: inherit;">Text</mark></p>'
    const wrapper = mount(OcRichTextEditor, { props: { modelValue: source } })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [{ marks: [expect.objectContaining({
        type: 'dynamicStyle', attrs: { tag: 'mark', rawStyle: 'background-color: {{parent.color}}; color: inherit;' },
      })] }] }],
    })
    expect(editor.getHTML()).toContain('data-oc-dynamic-style="background-color: {{parent.color}}; color: inherit;"')
    wrapper.unmount()
  })
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
          value: 'font:brand-sans',
          cssFamily: '"OpenCardProjectFont-brand-sans"',
        }],
        baseStyle: { fontFamily: '"OpenCardProjectFont-brand-sans"', fontSize: '32px' },
      },
    })
    await nextTick()
    await nextTick()
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    editor.commands.setTextSelection({ from: 1, to: 6 })

    wrapper.getComponent(OcSelect).vm.$emit('update:modelValue', 'font:brand-sans')
    await nextTick()

    expect(editor.getHTML()).toContain('font-family: &quot;OpenCardProjectFont-brand-sans&quot;')
    expect(wrapper.getComponent(OcSelect).props('modelValue')).toBe('font:brand-sans')
    expect(wrapper.getComponent(OcSelect).props('options')).toContainEqual({
      label: 'Brand Sans',
      value: 'font:brand-sans',
      cssFamily: '"OpenCardProjectFont-brand-sans"',
      labelStyle: { fontFamily: '"OpenCardProjectFont-brand-sans"' },
    })
    expect((wrapper.get('.oc-rich-text-editor').element as HTMLElement).style.fontFamily).toBe('')
    expect((wrapper.get('.oc-rich-text-editor__surface').element as HTMLElement).style.fontFamily)
      .toBe('"OpenCardProjectFont-brand-sans"')
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

  it('keeps project icons atomic and serializes only safe keys with fallback text', async () => {
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p><span data-oc-icon-series="status" data-oc-icon-key="wide">ignored</span></p>',
        projectIconCatalog: {
          series: [{ name: 'Status icons', key: 'status', source: 'status.png', src: 'asset://status', imageWidth: 16, imageHeight: 8 }],
          entries: [{ seriesKey: 'status', iconKey: 'wide', name: 'Wide', source: 'status.png', src: 'asset://status', x: 0, y: 0, width: 8, height: 4, imageWidth: 16, imageHeight: 8 }],
          errors: [],
        },
      },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    await nextTick()
    await nextTick()
    let iconNode = null as ReturnType<typeof editor.state.doc.nodeAt>
    editor.state.doc.descendants((node) => { if (node.type.name === 'projectIcon') iconNode = node })
    expect(iconNode?.isAtom).toBe(true)
    expect(editor.getHTML()).toBe('<p><span data-oc-icon-series="status" data-oc-icon-key="wide">[[icon:status/wide]]</span></p>')
    expect(editor.getText()).toBe('[[icon:status/wide]]')
    expect(editor.getHTML()).not.toContain('asset://')
    expect(editor.view.dom.textContent).not.toContain('[[icon:')
    wrapper.unmount()
  })

  it('inserts and replaces selected project icons through a hierarchical action menu', async () => {
    const projectIconCatalog = {
      series: [{ name: 'Status icons', key: 'status', source: 'status.png', src: 'asset://status', imageWidth: 16, imageHeight: 8 }],
      entries: [
        { seriesKey: 'status', iconKey: 'wide', name: 'Wide', source: 'status.png', src: 'asset://status', x: 0, y: 0, width: 8, height: 4, imageWidth: 16, imageHeight: 8 },
        { seriesKey: 'status', iconKey: 'narrow', name: 'Narrow', source: 'status.png', src: 'asset://status', x: 8, y: 0, width: 4, height: 8, imageWidth: 16, imageHeight: 8 },
      ],
      errors: [],
    } as const
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p></p>', projectIconCatalog },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    await nextTick()
    await nextTick()

    let iconAction = wrapper.findAllComponents(OcActionButton)
      .find(component => component.props('action').key === 'project-icon')!
    expect(iconAction.props('action')).toMatchObject({
      title: '插入项目图标',
      children: [{
        title: 'Status icons',
        children: [
          { title: 'Wide', key: 'project-icon:status/wide' },
          { title: 'Narrow', key: 'project-icon:status/narrow' },
        ],
      }],
    })
    const firstSeriesAction = iconAction.props('action').children?.[0] as OcActionButtonAction
    const firstIconAction = firstSeriesAction.children?.[0] as OcActionButtonAction
    expect(firstIconAction.thumbnailStyle).toBeDefined()
    editor.chain().focus().setMark('textStyle', { fontSize: '40px' }).run()
    iconAction.vm.$emit('select', { key: 'project-icon:status/wide' })
    await nextTick()
    expect(editor.getHTML()).toContain('data-oc-icon-key="wide"')
    let insertedIcon = null as ReturnType<typeof editor.state.doc.nodeAt>
    editor.state.doc.descendants(node => { if (node.type.name === 'projectIcon') insertedIcon = node })
    expect(insertedIcon?.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize).toBe('40px')
    expect(editor.view.dom.textContent).not.toContain('[[icon:')

    editor.view.dom.querySelector<HTMLElement>('.project-icon-node')!.click()
    await nextTick()
    expect(editor.state.selection).toBeInstanceOf(NodeSelection)
    expect(editor.view.dom.querySelector('.project-icon-node')?.classList.contains('is-selected')).toBe(true)
    iconAction = wrapper.findAllComponents(OcActionButton)
      .find(component => component.props('action').key === 'project-icon')!
    expect(iconAction.props('action').title).toBe('替换项目图标')
    iconAction.vm.$emit('select', { key: 'project-icon:status/narrow' })
    await nextTick()
    expect(editor.getHTML()).toContain('data-oc-icon-key="narrow"')
    insertedIcon = (editor.state.selection as NodeSelection).node
    expect(insertedIcon?.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize).toBe('40px')
    expect(editor.view.dom.querySelector('.project-icon-node button')).toBeNull()
    expect(editor.view.dom.textContent).not.toContain('[[icon:')
    editor.commands.deleteSelection()
    expect(editor.getHTML()).not.toContain('data-oc-icon-key')
    wrapper.unmount()
  })

  it('uses a two-row toolbar and caches five icons from menu and bracket completion', async () => {
    clearRecentProjectIcons()
    const icons = Array.from({ length: 6 }, (_, index) => ({
      iconKey: `icon-${index + 1}`,
      name: `Icon ${index + 1}`,
      x: index * 4,
      y: 0,
      width: 4,
      height: 4,
    }))
    const series = [{ name: 'Status icons', key: 'status', source: 'status.png', icons }]
    const projectIconCatalog = {
      series: [{ name: 'Status icons', key: 'status', source: 'status.png', src: 'asset://status', imageWidth: 24, imageHeight: 4 }],
      entries: icons.map(icon => ({
        ...icon,
        seriesKey: 'status',
        source: 'status.png',
        src: 'asset://status',
        imageWidth: 24,
        imageHeight: 4,
      })),
      errors: [],
    }
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p></p>',
        projectIconCatalog,
        projectIconCompletion: createProjectIconCompletionProvider(series, projectIconCatalog),
      },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    await nextTick()
    expect(wrapper.findAll('.oc-rich-text-editor__toolbar-row')).toHaveLength(2)

    const iconAction = wrapper.findAllComponents(OcActionButton)
      .find(component => component.props('action').key === 'project-icon')!
    iconAction.vm.$emit('select', { key: 'project-icon:status/icon-1' })
    await nextTick()
    expect(wrapper.findAll('.oc-rich-text-editor__recent-icon')).toHaveLength(1)
    const recentButton = wrapper.get('.oc-rich-text-editor__recent-icon')
    expect(recentButton.classes()).toContain('oc-button--icon-only')
    expect(recentButton.find('.oc-button__label').exists()).toBe(false)
    expect(recentButton.find('.oc-rich-text-editor__recent-icon-image').exists()).toBe(true)

    editor.chain().focus('end').setMark('textStyle', { fontSize: '32px' })
      .insertContent(' [[status/Icon 6]]').run()
    await vi.waitFor(() => expect(document.querySelector('.oc-autocomplete-popover')).not.toBeNull())
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(editor.getHTML()).toContain('data-oc-icon-key="icon-6"')
    let completedIcon = null as ReturnType<typeof editor.state.doc.nodeAt>
    editor.state.doc.descendants(node => {
      if (node.type.name === 'projectIcon' && node.attrs.iconKey === 'icon-6') completedIcon = node
    })
    expect(completedIcon?.marks.find(mark => mark.type.name === 'textStyle')?.attrs.fontSize).toBe('32px')
    expect(wrapper.findAll('.oc-rich-text-editor__recent-icon').map(button => button.attributes('aria-label')))
      .toEqual(['插入最近图标：Icon 6', '插入最近图标：Icon 1'])

    for (const index of [2, 3, 4, 5]) {
      iconAction.vm.$emit('select', { key: `project-icon:status/icon-${index}` })
    }
    await nextTick()
    expect(wrapper.findAll('.oc-rich-text-editor__recent-icon').map(button => button.attributes('aria-label')))
      .toEqual([
        '插入最近图标：Icon 5',
        '插入最近图标：Icon 4',
        '插入最近图标：Icon 3',
        '插入最近图标：Icon 2',
        '插入最近图标：Icon 6',
      ])
    wrapper.unmount()
    clearRecentProjectIcons()
  })

  it('supports lists and basic table editing', async () => {
    const wrapper = mount(OcRichTextEditor, { props: { modelValue: '<p>Text</p>' } })
    await nextTick()
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    editor.commands.toggleBulletList()
    expect(editor.getHTML()).toContain('<ul>')
    editor.commands.insertTable({ rows: 2, cols: 2, withHeaderRow: true })
    expect(editor.getHTML()).toContain('<table')
    editor.commands.addRowAfter()
    expect(editor.getHTML().match(/<tr>/g)?.length).toBe(3)
    editor.commands.addColumnBefore()
    expect(editor.getHTML().match(/<th|<td/g)?.length).toBe(9)
    editor.commands.toggleHeaderRow()
    expect(editor.getHTML()).not.toContain('<th')
    editor.commands.deleteTable()
    expect(editor.getHTML()).not.toContain('<table')
    wrapper.unmount()
  })

  it('loads and edits only public fields on embedded custom blocks', async () => {
    const ensureLoaded = vi.fn(async (_key: string) => undefined)
    const root = Object.assign({
      type: 'text-block' as const, id: 'root', content: '', label: 'Default', secret: 'Private',
      additionalFieldDefinition: {
        label: { fieldType: 'string' as const, title: 'Label' },
        secret: { fieldType: 'string' as const, title: 'Secret' },
      },
    })
    const entry = {
      manifest: {
        type: 'opencard-custom-block' as const, customBlockKey: 'badge', name: 'Badge',
        publicFieldKeys: ['label'], resize: { widthLocked: true, heightLocked: true },
      }, block: root, archivePath: 'badge.ocblock', files: new Map(),
    }
    const catalog = new Map([['badge', entry]])
    const manifests = new Map([['badge', { manifest: entry.manifest, archivePath: 'badge.ocblock', loadState: 'ready' as const }]])
    const wrapper = mount(OcRichTextEditor, {
      props: { modelValue: '<p></p>', customBlockCatalog: { catalog, manifests, ensureLoaded } },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    await ensureLoaded('badge')
    editor.chain().focus().insertContent({ type: 'inlineCustomBlock', attrs: { embedId: 'badge-1', customBlockKey: 'badge', properties: {} } }).run()
    editor.commands.setNodeSelection(editor.state.selection.from - 1)
    await nextTick()
    expect(editor.getHTML()).toContain('data-oc-key="badge"')
    ;(wrapper.vm as unknown as { openSelectedNodeEditor: () => void }).openSelectedNodeEditor()
    await nextTick()
    expect(wrapper.findComponent(PropertyEditor).exists()).toBe(true)
    expect(document.querySelector('.oc-rich-text-editor__node-dialog-content')?.textContent).toContain('label')
    expect(document.querySelector('.oc-rich-text-editor__node-dialog-content')?.textContent).not.toContain('secret')
    wrapper.unmount()
  })

  it('exposes custom block loading and failure states and clears them after a successful retry', async () => {
    let settleLoad = (): void => undefined
    let rejectFirst = true
    const root = Object.assign({ type: 'text-block' as const, id: 'root', content: 'Ready' })
    const entry = {
      manifest: {
        type: 'opencard-custom-block' as const, customBlockKey: 'badge', name: 'Badge',
        publicFieldKeys: [], resize: { widthLocked: true, heightLocked: true },
      }, block: root, archivePath: 'badge.ocblock', files: new Map(),
    }
    const catalog = new Map<string, typeof entry>()
    const ensureLoaded = vi.fn(() => new Promise<void>((resolve, reject) => {
      settleLoad = () => {
        if (rejectFirst) reject(new Error('load failed'))
        else { catalog.set('badge', entry); resolve() }
      }
    }))
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p></p>',
        customBlockCatalog: {
          catalog,
          manifests: new Map([['badge', { manifest: entry.manifest, archivePath: 'badge.ocblock', loadState: 'unloaded' as const }]]),
          ensureLoaded,
        },
      },
    })
    await nextTick()
    await nextTick()
    const actionButton = wrapper.findAllComponents(OcActionButton)
      .find(component => component.props('action').key === 'custom-block')!
    actionButton.vm.$emit('select', { key: 'custom-block:badge' })
    await nextTick()
    expect((actionButton.props('action') as OcActionButtonAction).children?.[0]).toMatchObject({ disabled: true })
    settleLoad()
    await vi.waitFor(() => expect(ensureLoaded).toHaveBeenCalledTimes(1))
    await nextTick()
    await nextTick()
    expect((actionButton.props('action') as OcActionButtonAction).children?.[0]).toMatchObject({ icon: 'status.warning' })
    expect((wrapper.vm as unknown as { editor: Editor }).editor.getHTML()).not.toContain('oc-custom-block')

    rejectFirst = false
    actionButton.vm.$emit('select', { key: 'custom-block:badge' })
    await nextTick()
    settleLoad()
    await vi.waitFor(() => expect((wrapper.vm as unknown as { editor: Editor }).editor.getHTML()).toContain('data-oc-key="badge"'))
    await nextTick()
    expect((actionButton.props('action') as OcActionButtonAction).children?.[0]).toMatchObject({ icon: 'data.symbol-custom-block' })
    wrapper.unmount()
  })

  it('switches bindable custom block fields between typed and binding editors', async () => {
    const root = Object.assign({
      type: 'text-block' as const, id: 'root', content: '', amount: '2',
      additionalFieldDefinition: {
        amount: { fieldType: 'number' as const, title: 'Amount', min: 1, max: 10 },
      },
    })
    const entry = {
      manifest: {
        type: 'opencard-custom-block' as const, customBlockKey: 'counter', name: 'Counter',
        publicFieldKeys: ['amount'], resize: { widthLocked: true, heightLocked: true },
      }, block: root, archivePath: 'counter.ocblock', files: new Map(),
    }
    const wrapper = mount(OcRichTextEditor, {
      props: {
        modelValue: '<p><oc-custom-block data-oc-id="counter-1" data-oc-key="counter" data-oc-layout="inline"></oc-custom-block></p>',
        bindingCompletion: () => null,
        customBlockCatalog: {
          catalog: new Map([['counter', entry]]),
          manifests: new Map([['counter', { manifest: entry.manifest, archivePath: 'counter.ocblock', loadState: 'ready' as const }]]),
          ensureLoaded: async () => undefined,
        },
      },
    })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    let position = -1
    editor.state.doc.descendants((node, nodePosition) => {
      if (node.type.name === 'inlineCustomBlock') position = nodePosition
    })
    editor.commands.setNodeSelection(position)
    await nextTick()
    ;(wrapper.vm as unknown as { openSelectedNodeEditor: () => void }).openSelectedNodeEditor()
    await nextTick()

    const dialogField = document.querySelector('[role="dialog"]')!
    const fieldRenderer = wrapper.findAllComponents(PropertyFieldRenderer)[0]!
    const actionRail = wrapper.findAllComponents(PropertyFieldActionRail)[0]!
    expect(fieldRenderer.props('editorId')).toBe('field')
    actionRail.vm.$emit('action', 'field-editor.use-raw-string')
    await nextTick()
    const field = wrapper.findAllComponents(PropertyFieldRenderer).find(component => dialogField.contains(component.element))!
    expect(field.props('editorId')).toBe('raw-string')
    field.vm.$emit('update:value', '{{parent:amount}}')
    await nextTick()
    expect(editor.getHTML()).not.toContain('<oc-prop data-oc-key="amount">')
    ;(wrapper.vm as unknown as { confirmSelectedNodeEditor: () => void }).confirmSelectedNodeEditor()
    await nextTick()
    expect(editor.getHTML()).toContain('<oc-prop data-oc-key="amount">{{parent:amount}}</oc-prop>')
    expect(field.props('editorId')).toBe('raw-string')
    expect(actionRail.props('actions')).toEqual([
      expect.objectContaining({ key: 'reset-property' }),
    ])
    wrapper.unmount()
  })

  it('regenerates embed IDs on paste while undo keeps the pasted ID stable', async () => {
    const source = '<p><oc-custom-block data-oc-id="original" data-oc-key="badge" data-oc-layout="inline"></oc-custom-block></p>'
    const wrapper = mount(OcRichTextEditor, { props: { modelValue: source } })
    const editor = (wrapper.vm as unknown as { editor: Editor }).editor
    const original = editor.state.doc.firstChild!.firstChild!
    const pasted = remapPastedEmbedIds(new Slice(Fragment.from(original), 0, 0))
    const pastedId = pasted.content.firstChild?.attrs.embedId
    expect(pastedId).not.toBe('original')
    editor.chain().focus('end').insertContent(pasted.content.toJSON()).run()
    editor.commands.undo()
    editor.commands.redo()
    const embedIds: string[] = []
    editor.state.doc.descendants(node => {
      if (node.type.name === 'inlineCustomBlock' || node.type.name === 'blockCustomBlock') embedIds.push(node.attrs.embedId)
    })
    expect(embedIds).toContain(pastedId)
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

    ;(wrapper.vm as unknown as { openSelectedNodeEditor: () => void }).openSelectedNodeEditor()
    await nextTick()

    let input = document.querySelector<HTMLInputElement>('.oc-rich-text-editor__dialog-binding-field input')!
    input.value = 'project:name'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    ;(wrapper.vm as unknown as { cancelSelectedNodeEditor: () => void }).cancelSelectedNodeEditor()
    await nextTick()

    expect(editor.getHTML()).toContain('data-oc-binding="self:name"')
    expect(document.querySelector('[aria-label="Binding expression"]')).toBeNull()

    label.click()
    await nextTick()
    ;(wrapper.vm as unknown as { openSelectedNodeEditor: () => void }).openSelectedNodeEditor()
    await nextTick()
    input = document.querySelector<HTMLInputElement>('.oc-rich-text-editor__dialog-binding-field input')!
    input.value = 'project:name'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    document.querySelectorAll<HTMLButtonElement>('.oc-dialog__footer .oc-button')[1]!.click()
    await nextTick()

    expect(editor.getHTML()).toContain('data-oc-binding="project:name"')
    expect(editor.getHTML()).toContain('{{project:name}}')

    editor.view.dom.querySelector<HTMLElement>('.binding-node__label')!.click()
    editor.commands.deleteSelection()
    expect(editor.state.doc.firstChild?.childCount).toBe(0)
    wrapper.unmount()
  })
})
