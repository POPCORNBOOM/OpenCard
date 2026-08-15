import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import OcTree from '../../../components/standard/OcTree.vue'
import CustomBlockExportDialog from './CustomBlockExportDialog.vue'

const baseProps = {
  open: true,
  dialogTitle: 'Export custom Block',
  fields: [
    { key: 'size', fieldType: 'number' as const, title: 'Size', referenceCount: 3, definitionOrder: 0, exposed: false },
    { key: 'color', fieldType: 'color' as const, title: 'Color', referenceCount: 2, definitionOrder: 1, exposed: false },
  ],
  resize: { widthLocked: false, heightLocked: false },
  widthLabel: 'Width',
  heightLabel: 'Height',
  defaultName: 'Square',
  defaultKey: 'square',
  nameLabel: 'Name',
  keyLabel: 'Key',
  cancelLabel: 'Cancel',
  exportLabel: 'Export',
  busyLabel: 'Exporting...',
  fieldsLabel: 'Public fields',
  exposedLabel: 'Available to users',
  privateLabel: 'Not exposed to users',
  moveToExposedLabel: 'Expose',
  moveToPrivateLabel: 'Hide',
  formatReferenceCount: (count: number) => count === 1 ? '1 reference' : `${count} references`,
}

describe('CustomBlockExportDialog', () => {
  it('keeps dimensions exposed while defaulting additional fields to private', () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.getComponent(OcTree)

    expect(tree.props('expandedKeys')).toEqual(['group:exposed', 'group:private'])
    expect(tree.props('data').items.get('group:exposed')?.label).toBe('Available to users')
    expect(tree.props('data').items.get('group:private')?.label).toBe('Not exposed to users')
    expect(tree.props('data').children.get('group:exposed')).toEqual(['resize:width', 'resize:height'])
    expect(tree.props('data').children.get('group:private')).toEqual(['field:size', 'field:color'])
    expect(tree.props('actionVisibility')).toBe('always')
    expect(tree.props('actions')!.get('move-exposed')?.icon).toBe('nav.arrow-up')
    expect(tree.props('actions')!.get('move-private')?.icon).toBe('nav.arrow-down')
  })

  it('writes dimension availability to resize without adding it to public fields', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'resize:width', actionKey: 'move-private', source: 'inline',
    })
    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'field:size', actionKey: 'move-exposed', source: 'inline',
    })
    await wrapper.vm.$nextTick()
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      exposedFieldKeys: ['size'],
      resize: { widthLocked: true, heightLocked: false },
    })
  })

  it('moves fields by row action or by dropping beside a field in the other group', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', {
      type: 'action.invoke',
      key: 'field:size',
      actionKey: 'move-exposed',
      source: 'inline',
    })
    await wrapper.vm.$nextTick()
    tree.vm.$emit('intent', {
      type: 'move.request',
      key: 'field:color',
      targetKey: 'field:size',
      position: 'after',
    })
    await wrapper.vm.$nextTick()

    expect(tree.props('data').children.get('group:exposed'))
      .toEqual(['resize:width', 'resize:height', 'field:size', 'field:color'])
  })

  it('blocks duplicate submit and dismissal while export is busy', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: { ...baseProps, busy: true },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.text()).toContain('Exporting...')
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('button[type="button"]').trigger('click')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('uses the live name-derived placeholder when the key is left empty', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true } },
    })
    const [nameInput, keyInput] = wrapper.findAll('input')

    expect((keyInput!.element as HTMLInputElement).value).toBe('')
    expect(keyInput!.attributes('placeholder')).toBe('square')
    await nameInput!.setValue('Round Container')
    await keyInput!.setValue('   ')
    expect(keyInput!.attributes('placeholder')).toBe('round-container')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      name: 'Round Container',
      key: 'round-container',
    })
  })

  it('prefers an explicitly entered key over the generated placeholder', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true } },
    })
    const keyInput = wrapper.findAll('input')[1]!
    await keyInput.setValue('custom.square')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ key: 'custom.square' })
  })

  it('renders export failures as a repeatable alert', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: { ...baseProps, errorText: 'Export failed' },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.get('[role="alert"]').text()).toBe('Export failed')
    await wrapper.setProps({ errorText: '' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper.setProps({ errorText: 'Export failed' })
    expect(wrapper.get('[role="alert"]').text()).toBe('Export failed')
  })

  it('labels zero, singular, and multiple field reference counts', () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: {
        ...baseProps,
        fields: [
          { key: 'unused', fieldType: 'string', title: 'Unused', referenceCount: 0, definitionOrder: 0, exposed: false },
          { key: 'title', fieldType: 'string', title: 'Title', referenceCount: 1, definitionOrder: 1, exposed: false },
          { key: 'color', fieldType: 'color', title: 'Color', referenceCount: 3, definitionOrder: 2, exposed: false },
        ],
      },
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.getComponent(OcTree)

    expect(tree.props('data').items.get('field:unused')?.tail).toBe('0 references')
    expect(tree.props('data').items.get('field:title')?.tail).toBe('1 reference')
    expect(tree.props('data').items.get('field:color')?.tail).toBe('3 references')
    expect(wrapper.get('[data-oc-tree-key="field:unused"]').text()).toContain('0 references')
    expect(wrapper.get('[data-oc-tree-key="field:title"]').text()).toContain('1 reference')
    expect(wrapper.get('[data-oc-tree-key="field:color"]').text()).toContain('3 references')
  })

  it('groups packaged resources and previews the selected resource beside the tree', async () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: {
        ...baseProps,
        resourceIndex: {
          fonts: [{
            kind: 'font', key: 'body', name: 'Body',
            files: { normal: { upright: 'resources/fonts/body.woff2' } },
          }],
          images: [{ key: 'cover', source: 'resources/images/cover.png' }],
        },
        resourceImageLabels: new Map([['resources/images/cover.png', 'cover.png']]),
        fontPreviewText: 'Aa Font preview',
      },
      global: { stubs: { Teleport: true } },
    })
    const resourceTree = wrapper.findAllComponents(OcTree)[1]!

    expect(resourceTree.props('data').rootKeys).toEqual([
      'resource-group:fonts',
      'resource-group:icons',
      'resource-group:images',
    ])
    expect(resourceTree.props('data').items.get('resource:image:cover')?.label).toBe('cover.png')

    resourceTree.vm.$emit('intent', {
      type: 'selection.change',
      triggerKey: 'resource:font:body',
      selectedKeys: ['resource:font:body'],
      mode: 'replace',
      input: 'left',
    })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.custom-block-export-dialog__font-preview').text()).toBe('Aa Font preview')
    expect(wrapper.get('.custom-block-export-dialog__preview-source').text()).toBe('resources/fonts/body.woff2')
  })
})
