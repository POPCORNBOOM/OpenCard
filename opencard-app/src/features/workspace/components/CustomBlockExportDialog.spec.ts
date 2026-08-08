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
  defaultName: 'Square',
  defaultKey: 'square',
  nameLabel: 'Name',
  keyLabel: 'Key',
  cancelLabel: 'Cancel',
  exportLabel: 'Export',
  fieldsLabel: 'Public fields',
  exposedLabel: 'Available to users',
  privateLabel: 'Not exposed to users',
  moveToExposedLabel: 'Expose',
  moveToPrivateLabel: 'Hide',
}

describe('CustomBlockExportDialog', () => {
  it('keeps both titled groups expanded and defaults every root field to private', () => {
    const wrapper = mount(CustomBlockExportDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true } },
    })
    const tree = wrapper.getComponent(OcTree)

    expect(tree.props('expandedKeys')).toEqual(['group:exposed', 'group:private'])
    expect(tree.props('data').items.get('group:exposed')?.label).toBe('Available to users')
    expect(tree.props('data').items.get('group:private')?.label).toBe('Not exposed to users')
    expect(tree.props('data').children.get('group:private')).toEqual(['field:size', 'field:color'])
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

    expect(tree.props('data').children.get('group:exposed')).toEqual(['field:size', 'field:color'])
  })
})
