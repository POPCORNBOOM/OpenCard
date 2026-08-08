import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcTree from '../standard/OcTree.vue'
import ProjectCustomBlockRegistryEditor from './ProjectCustomBlockRegistryEditor.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  importProjectCustomBlockFile: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
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
    expect(JSON.parse(updates[updates.length - 1]?.[0] as string)).toEqual({})
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('uses the shared repair editor for invalid registry JSON', () => {
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: { filePath: 'D:/Demo/.ocblocks', modelValue: '{broken' },
    })

    expect(wrapper.find('.monaco-stub').exists()).toBe(true)
    expect(wrapper.findComponent(OcTree).exists()).toBe(false)
  })
})
