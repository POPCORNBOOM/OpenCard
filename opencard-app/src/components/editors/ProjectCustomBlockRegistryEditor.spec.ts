import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcTree from '../standard/OcTree.vue'
import ProjectCustomBlockRegistryEditor from './ProjectCustomBlockRegistryEditor.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  importProjectCustomBlockFile: vi.fn(),
  readProjectCustomBlockPackage: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
}))
vi.mock('../../features/workspace/services/projectCustomBlock', () => ({
  readProjectCustomBlockPackage: mocks.readProjectCustomBlockPackage,
}))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/Demo' },
    importProjectCustomBlockFile: mocks.importProjectCustomBlockFile,
  }),
}))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

describe('ProjectCustomBlockRegistryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readProjectCustomBlockPackage.mockRejectedValue(new Error('not available'))
  })

  it('replaces a compatible same-key path and requests an immediate save', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/square.ocblock')
    mocks.importProjectCustomBlockFile.mockResolvedValue({
      source: 'assets/blocks/square.ocblock',
      copied: true,
      replacedSource: 'library/old-square.ocblock',
    })
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/Demo/.ocblocks',
        modelValue: JSON.stringify({
          blocks: ['library/old-square.ocblock', 'library/circle.ocblock'],
        }),
      },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({
      blocks: ['library/circle.ocblock', 'assets/blocks/square.ocblock'],
    })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('removes a registered path through the standard tree action', async () => {
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/Demo/.ocblocks',
        modelValue: '{"blocks":["assets/blocks/square.ocblock"]}',
      },
    })

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke',
      key: 'assets/blocks/square.ocblock',
      actionKey: 'remove',
    })
    await flushPromises()

    const updates = wrapper.emitted('update:modelValue') ?? []
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({ blocks: [] })
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('uses the shared repair editor for invalid registry JSON', () => {
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: { filePath: 'D:/Demo/.ocblocks', modelValue: '{broken' },
    })

    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
    expect(wrapper.findComponent(OcTree).exists()).toBe(false)
  })

  it('announces a sanitized import failure and clears it after a successful retry', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/square.ocblock')
    mocks.importProjectCustomBlockFile.mockRejectedValueOnce(new Error('D:/private/package.ocblock is corrupt'))
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: { filePath: 'D:/Demo/.ocblocks', modelValue: '{"blocks":[]}' },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('customBlockRegistry.importFailed')
    expect(wrapper.text()).not.toContain('D:/private/package.ocblock')

    mocks.importProjectCustomBlockFile.mockResolvedValueOnce({
      source: 'assets/blocks/square.ocblock',
      copied: true,
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('does not report cancellation as an import error', async () => {
    mocks.pickFile.mockResolvedValue(null)
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: { filePath: 'D:/Demo/.ocblocks', modelValue: '{"blocks":[]}' },
    })

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(mocks.importProjectCustomBlockFile).not.toHaveBeenCalled()
  })

  it('pairs renamed packages by manifest key and keeps both sides inspectable', async () => {
    mocks.readProjectCustomBlockPackage.mockImplementation(async (_fs: unknown, path: string) => ({
      manifest: path.includes('history')
        ? {
            type: 'opencard-custom-block', schemaVersion: '1', key: 'square', name: 'Square A',
            interfaceHash: 'hash-a', root: { type: 'text', id: 'root', name: 'Square' },
            publicFields: [], resize: { widthLocked: true, heightLocked: true },
          }
        : {
            type: 'opencard-custom-block', schemaVersion: '1', key: 'square', name: 'Square B',
            interfaceHash: 'hash-b', root: { type: 'text', id: 'root', name: 'Square' },
            publicFields: [], resize: { widthLocked: true, heightLocked: true },
          },
      files: new Map(),
    }))
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/current/.ocblocks',
        resourceRootPath: 'D:/current',
        comparisonResourceRootPath: 'D:/history',
        modelValue: '{"blocks":["assets/blocks/square.ocblock"]}',
        comparisonContent: '{"blocks":["history/square.ocblock"]}',
        access: 'observe-only',
      },
    })
    await flushPromises()

    const tree = wrapper.getComponent(OcTree)
    const item = tree.props('data').items.get('assets/blocks/square.ocblock')
    expect(item).toMatchObject({
      changeMarkers: [
        { icon: 'status.change-removed', tone: 'danger' },
        { icon: 'status.change-added', tone: 'success' },
      ],
      actions: [],
      contextActions: [],
    })
    expect(wrapper.text()).toContain('Square A')
    expect(wrapper.text()).toContain('Square B')
    expect(wrapper.text()).toContain('history/square.ocblock')
    expect(wrapper.text()).toContain('assets/blocks/square.ocblock')
  })

  it('highlights only registry detail fields whose values changed', async () => {
    mocks.readProjectCustomBlockPackage.mockImplementation(async (_fs: unknown, path: string) => ({
      manifest: {
        type: 'opencard-custom-block', schemaVersion: '1', key: 'square',
        name: path.includes('history') ? 'Square A' : 'Square B',
        interfaceHash: 'shared-hash', root: { type: 'text', id: 'root', name: 'Square' },
        publicFields: [], resize: { widthLocked: true, heightLocked: true },
      },
      files: new Map(),
    }))
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/current/.ocblocks',
        resourceRootPath: 'D:/current',
        comparisonResourceRootPath: 'D:/history',
        modelValue: '{"blocks":["blocks/square.ocblock"]}',
        comparisonContent: '{"blocks":["blocks/square.ocblock"]}',
        access: 'observe-only',
      },
    })
    await flushPromises()

    const rows = wrapper.findAll('.custom-block-registry-editor__detail-side dl > div')
    expect(rows.map(row => row.attributes('data-change-state'))).toEqual([
      'unchanged', 'changed', 'unchanged', 'unchanged', 'unchanged',
      'unchanged', 'changed', 'unchanged', 'unchanged', 'unchanged',
    ])
  })

  it('keeps same-interface packages paired by path when only their order changes', async () => {
    mocks.readProjectCustomBlockPackage.mockImplementation(async (_fs: unknown, path: string) => {
      const key = path.includes('circle') ? 'circle' : 'square'
      return {
        manifest: {
          type: 'opencard-custom-block', schemaVersion: '1', key, name: key,
          interfaceHash: 'shared-hash', root: { type: 'text', id: 'root', name: key },
          publicFields: [], resize: { widthLocked: true, heightLocked: true },
        },
        files: new Map(),
      }
    })
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/current/.ocblocks',
        resourceRootPath: 'D:/current',
        comparisonResourceRootPath: 'D:/history',
        modelValue: '{"blocks":["blocks/square.ocblock","blocks/circle.ocblock"]}',
        comparisonContent: '{"blocks":["blocks/circle.ocblock","blocks/square.ocblock"]}',
        access: 'observe-only',
      },
    })
    await flushPromises()

    const items = [...wrapper.getComponent(OcTree).props('data').items.values()]
    expect(items.map(item => item.changeMarkers)).toEqual([undefined, undefined])
    expect(wrapper.findAll('[data-change-state="changed"]')).toHaveLength(0)
  })

  it('reuses the registry tree as an observe-only comparison', async () => {
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/snapshot/.ocblocks',
        modelValue: '{"blocks":["blocks/removed.ocblock","blocks/shared.ocblock"]}',
        comparisonContent: '{"blocks":["blocks/shared.ocblock"]}',
        comparisonSide: 'historical',
        access: 'observe-only',
      },
    })

    expect(wrapper.find('button').exists()).toBe(false)
    const tree = wrapper.getComponent(OcTree)
    const removed = tree.props('data').items.get('blocks/removed.ocblock')
    expect(removed).toMatchObject({
      icon: 'file.custom-block',
      changeMarkers: [{ icon: 'status.change-removed', tone: 'danger' }],
      actions: [],
    })
    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'blocks/removed.ocblock', actionKey: 'remove', source: 'inline',
    })
    await flushPromises()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
