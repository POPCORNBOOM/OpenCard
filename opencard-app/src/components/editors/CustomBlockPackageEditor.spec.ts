import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcButton from '../base/OcButton.vue'
import CustomBlockPackageEditor from './CustomBlockPackageEditor.vue'

const mocks = vi.hoisted(() => ({
  projectPath: { value: 'D:/Demo' },
  manifestCatalog: { value: new Map() },
  readProjectCustomBlockPackage: vi.fn(),
  installProjectCustomBlockFile: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/projectCustomBlock', () => ({
  readProjectCustomBlockPackage: mocks.readProjectCustomBlockPackage,
}))
vi.mock('../../features/workspace/services/fileSystemService', () => ({ fileSystemService: {} }))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: mocks.projectPath,
    projectCustomBlockManifestCatalog: mocks.manifestCatalog,
    installProjectCustomBlockFile: mocks.installProjectCustomBlockFile,
  }),
}))

const packageResult = {
  manifest: {
    type: 'opencard-custom-block' as const,
    packageId: 'alice/square',
    version: '0.1.0',
    name: 'Square',
    publicFieldKeys: ['size', 'content'],
    resize: { widthLocked: true, heightLocked: true },
  },
  block: {
    type: 'text-block' as const, id: 'root', content: '', size: '100',
    additionalFieldDefinition: { size: { fieldType: 'number', title: 'Size' } },
  },
  issues: [],
}

describe('CustomBlockPackageEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectPath.value = 'D:/Demo'
    mocks.manifestCatalog.value = new Map()
    mocks.readProjectCustomBlockPackage.mockResolvedValue(packageResult)
    mocks.installProjectCustomBlockFile.mockResolvedValue({
      packageId: 'alice/square',
      installationPath: '.opencard/blocks/alice/square',
      resourceRootPath: '.opencard/blocks/alice/square/resources',
      replaced: false,
    })
  })

  it('validates and displays transport-package metadata without installing automatically', async () => {
    const wrapper = mount(CustomBlockPackageEditor, {
      props: { filePath: 'D:/Downloads/square.ocblock' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Square')
    expect(wrapper.text()).toContain('alice/square')
    expect(wrapper.text()).toContain('0.1.0')
    expect(wrapper.text()).toContain('Size')
    expect(mocks.installProjectCustomBlockFile).not.toHaveBeenCalled()
  })

  it('installs explicitly and labels an existing Package ID as an update', async () => {
    mocks.manifestCatalog.value = new Map([['alice/square', {
      manifest: packageResult.manifest,
      installationPath: 'D:/Demo/.opencard/blocks/alice/square',
      resourceRootPath: 'D:/Demo/.opencard/blocks/alice/square/resources',
      loadState: 'unloaded',
    }]])
    const wrapper = mount(CustomBlockPackageEditor, {
      props: { filePath: 'D:/Downloads/square.ocblock' },
    })
    await flushPromises()

    expect(wrapper.get('.custom-block-package-editor__actions button').text())
      .toContain('customBlockPackage.updateRegistration')
    await wrapper.get('.custom-block-package-editor__actions button').trigger('click')
    await flushPromises()

    expect(mocks.installProjectCustomBlockFile).toHaveBeenCalledWith('D:/Downloads/square.ocblock')
    expect(wrapper.text()).toContain('customBlockPackage.registered')
  })

  it('disables installation until a project is open', async () => {
    mocks.projectPath.value = ''
    const wrapper = mount(CustomBlockPackageEditor, {
      props: { filePath: 'D:/Downloads/square.ocblock' },
    })
    await flushPromises()

    expect(wrapper.getComponent(OcButton).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('customBlockPackage.projectRequired')
  })
})
