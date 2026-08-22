import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_PROJECT_ICON_CATALOG } from '../../features/workspace/services/projectIconCatalog'
import OcTree from '../standard/OcTree.vue'
import OcViewportInspector from '../standard/OcViewportInspector.vue'
import ProjectCustomBlockRegistryEditor from './ProjectCustomBlockRegistryEditor.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  installProjectCustomBlockFile: vi.fn(),
  uninstallProjectCustomBlock: vi.fn(),
  revealProjectCustomBlock: vi.fn(),
  reloadProjectCustomBlocks: vi.fn(),
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

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key, te: () => false }) }))
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
    installProjectCustomBlockFile: mocks.installProjectCustomBlockFile,
    uninstallProjectCustomBlock: mocks.uninstallProjectCustomBlock,
    revealProjectCustomBlock: mocks.revealProjectCustomBlock,
    reloadProjectCustomBlocks: mocks.reloadProjectCustomBlocks,
  }),
}))

function createEntry() {
  const manifest = {
    type: 'opencard-custom-block' as const,
    packageId: 'alice/square',
    version: '0.1.0',
    name: 'Square',
    publicFieldKeys: ['label'],
    resize: { widthLocked: false, heightLocked: false },
  }
  const block = {
    type: 'text-block' as const, id: 'root', content: '{{self:label}}', label: 'Ready',
    additionalFieldDefinition: { label: { fieldType: 'string', title: 'Label' } },
  }
  const installationPath = 'D:/Demo/.opencard/blocks/alice/square'
  const resourceRootPath = `${installationPath}/resources`
  const environment = {
    kind: 'package' as const,
    namespace: 'package-alice-square',
    rootPath: resourceRootPath,
    fontDocument: { fonts: [] },
    fonts: { families: [], compositions: [], errors: [] },
    iconDocument: { iconSeries: [] },
    iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
    issues: [],
    customBlockCatalog: new Map(),
  }
  return {
    entry: { manifest, block, installationPath, resourceRootPath },
    descriptor: { manifest, installationPath, resourceRootPath, loadState: 'ready' as const },
    runtime: { manifest, block, environment, dependencies: new Map() },
  }
}

function mountEditor() {
  return mount(ProjectCustomBlockRegistryEditor, {
    props: { filePath: 'D:/Demo/.opencard/blocks', modelValue: '' },
    global: {
      stubs: {
        CardViewport: {
          name: 'CardViewport',
          props: ['face', 'viewportInsets'],
          template: '<div class="viewport-stub" />',
        },
        PropertyEditor: {
          name: 'PropertyEditor',
          props: ['inputs'],
          emits: ['update-property'],
          template: '<div class="property-editor-stub" />',
        },
      },
    },
  })
}

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
    mocks.reloadProjectCustomBlocks.mockResolvedValue(undefined)
    mocks.uninstallProjectCustomBlock.mockResolvedValue(true)
    mocks.revealProjectCustomBlock.mockResolvedValue(undefined)
  })

  it('lists discovered Package IDs, versions, status, and installation metadata', async () => {
    const fixture = createEntry()
    mocks.projectCustomBlockManifestCatalog.value = new Map([['alice/square', fixture.descriptor]])
    mocks.projectCustomBlockCatalog.value = new Map([['alice/square', fixture.entry]])
    mocks.renderEnvironment.value.customBlockCatalog = new Map([['alice/square', fixture.runtime]])
    mocks.ensureProjectCustomBlockLoaded.mockResolvedValue(fixture.entry)

    const wrapper = mountEditor()
    await flushPromises()

    expect(mocks.reloadProjectCustomBlocks).toHaveBeenCalledOnce()
    expect(wrapper.getComponent(OcTree).text()).toContain('Square')
    expect(wrapper.getComponent(OcTree).text()).toContain('alice/square 0.1.0')
  })

  it('installs a selected transport package into the project', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/square.ocblock')
    mocks.installProjectCustomBlockFile.mockResolvedValue({
      packageId: 'alice/square',
      installationPath: '.opencard/blocks/alice/square',
      resourceRootPath: '.opencard/blocks/alice/square/resources',
      replaced: false,
    })
    const wrapper = mountEditor()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(mocks.installProjectCustomBlockFile).toHaveBeenCalledWith('D:/Downloads/square.ocblock')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('reveals and uninstalls the whole Package ID through tree actions', async () => {
    const fixture = createEntry()
    mocks.projectCustomBlockManifestCatalog.value = new Map([['alice/square', fixture.descriptor]])
    mocks.ensureProjectCustomBlockLoaded.mockResolvedValue(fixture.entry)
    const wrapper = mountEditor()
    await flushPromises()

    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'alice/square', actionKey: 'reveal',
    })
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'alice/square', actionKey: 'remove',
    })
    await flushPromises()

    expect(mocks.revealProjectCustomBlock).toHaveBeenCalledWith('alice/square')
    expect(mocks.uninstallProjectCustomBlock).toHaveBeenCalledWith('alice/square')
  })

  it('renders the shared runtime and keeps property edits in preview state', async () => {
    const fixture = createEntry()
    mocks.projectCustomBlockCatalog.value = new Map([['alice/square', fixture.entry]])
    mocks.projectCustomBlockManifestCatalog.value = new Map([['alice/square', fixture.descriptor]])
    mocks.ensureProjectCustomBlockLoaded.mockResolvedValue(fixture.entry)
    mocks.renderEnvironment.value.customBlockCatalog = new Map([['alice/square', fixture.runtime]])
    const wrapper = mountEditor()
    await flushPromises()

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
    inspector.vm.$emit('occlusion-change', 42)
    await wrapper.vm.$nextTick()
    expect(wrapper.getComponent({ name: 'CardViewport' }).props('viewportInsets')).toEqual({ bottom: 42 })
  })
})
