import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcTree from '../standard/OcTree.vue'
import OcViewportInspector from '../standard/OcViewportInspector.vue'
import ProjectCustomBlockRegistryEditor from './ProjectCustomBlockRegistryEditor.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  importProjectCustomBlockFile: vi.fn(),
  projectCustomBlockCatalog: { value: new Map() },
  projectCustomBlockManifestCatalog: { value: new Map() },
  ensureProjectCustomBlockLoaded: vi.fn(),
  renderEnvironment: {
    value: {
      project: null,
      dictionary: null,
      customBlockCatalog: new Map(),
      projectIconCatalog: { entries: [], errors: [] },
    },
  },
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
}))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/Demo' },
    projectCustomBlockCatalog: mocks.projectCustomBlockCatalog,
    projectCustomBlockManifestCatalog: mocks.projectCustomBlockManifestCatalog,
    ensureProjectCustomBlockLoaded: mocks.ensureProjectCustomBlockLoaded,
    renderEnvironment: mocks.renderEnvironment,
    importProjectCustomBlockFile: mocks.importProjectCustomBlockFile,
  }),
}))
vi.mock('./MonacoEditor.vue', () => ({ default: { template: '<div class="monaco-stub" />' } }))

describe('ProjectCustomBlockRegistryEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectCustomBlockCatalog.value = new Map()
    mocks.projectCustomBlockManifestCatalog.value = new Map()
    mocks.renderEnvironment.value = {
      project: null,
      dictionary: null,
      customBlockCatalog: new Map(),
      projectIconCatalog: { entries: [], errors: [] },
    }
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

  it('renders a catalog block and keeps property edits inside preview state', async () => {
    const entry = {
      archivePath: 'assets/blocks/square.ocblock',
      files: new Map(),
      manifest: {
        type: 'opencard-custom-block', customBlockKey: 'square', name: 'Square',
        publicFieldKeys: ['label'],
        resize: { widthLocked: false, heightLocked: false },
      },
      block: {
        type: 'text-block', id: 'root', content: '{{self:label}}', label: 'Ready',
        additionalFieldDefinition: { label: { fieldType: 'string', title: 'Label' } },
      },
    }
    mocks.projectCustomBlockCatalog.value = new Map([['square', entry]])
    mocks.projectCustomBlockManifestCatalog.value = new Map([['square', {
      manifest: entry.manifest,
      archivePath: entry.archivePath,
    }]])
    mocks.ensureProjectCustomBlockLoaded.mockResolvedValue(entry)
    mocks.renderEnvironment.value = {
      ...mocks.renderEnvironment.value,
      customBlockCatalog: new Map([['square', entry]]),
    }
    const wrapper = mount(ProjectCustomBlockRegistryEditor, {
      props: {
        filePath: 'D:/Demo/.ocblocks',
        modelValue: '{"blocks":["assets/blocks/square.ocblock"]}',
      },
      global: {
        stubs: {
          CardViewport: {
            name: 'CardViewport',
            props: ['face', 'viewportInsets'],
            template: '<div class="viewport-stub" />',
          },
          PropertyEditor: { name: 'PropertyEditor', props: ['inputs'], emits: ['update-property'], template: '<div class="property-editor-stub" />' },
        },
      },
    })
    await flushPromises()

    expect(wrapper.getComponent(OcTree).text()).toContain('Square')
    const propertyEditor = wrapper.getComponent({ name: 'PropertyEditor' })
    expect(propertyEditor.props('inputs')[0].record).toEqual({ label: 'Ready' })
    propertyEditor.vm.$emit('update-property', {
      key: 'custom-block-preview', fieldKey: 'label', value: 'Changed',
    })
    await flushPromises()

    expect(propertyEditor.props('inputs')[0].record).toEqual({ label: 'Changed' })
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('save')).toBeUndefined()

    const inspector = wrapper.getComponent(OcViewportInspector)
    inspector.vm.$emit('update:height', 360)
    inspector.vm.$emit('update:expanded', false)
    inspector.vm.$emit('occlusion-change', 42)
    await wrapper.vm.$nextTick()
    expect(inspector.props()).toMatchObject({ height: 360, expanded: false })
    expect(wrapper.getComponent({ name: 'CardViewport' }).props('viewportInsets')).toEqual({ bottom: 42 })
  })
})
