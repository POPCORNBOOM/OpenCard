import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OcButton from '../base/OcButton.vue'
import OcOptionGroup from '../standard/OcOptionGroup.vue'
import CustomBlockPackageEditor from './CustomBlockPackageEditor.vue'

const mocks = vi.hoisted(() => ({
  projectPath: { value: 'D:/Demo' },
  readProjectCustomBlockPackage: vi.fn(),
  getProjectCustomBlockImportConflict: vi.fn(),
  registerProjectCustomBlockFile: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/projectCustomBlock', () => ({
  readProjectCustomBlockPackage: mocks.readProjectCustomBlockPackage,
}))
vi.mock('../../features/workspace/services/fileSystemService', () => ({ fileSystemService: {} }))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({
    projectPath: mocks.projectPath,
    projectCustomBlockCatalog: { value: new Map() },
    getProjectCustomBlockImportConflict: mocks.getProjectCustomBlockImportConflict,
    registerProjectCustomBlockFile: mocks.registerProjectCustomBlockFile,
  }),
}))

const packageResult = {
  manifest: {
    type: 'opencard-custom-block',
    schemaVersion: '1',
    key: 'square',
    name: 'Square',
    interfaceHash: 'interface-hash',
    root: { type: 'text', id: 'root', name: 'Square' },
    publicFields: [{ key: 'size', fieldType: 'number', title: 'Size', defaultValue: '100' }],
    resize: { widthLocked: true, heightLocked: true },
    resources: {
      images: [{ key: 'logo', source: 'resources/images/logo.png' }],
    },
  },
  files: new Map(),
}

describe('CustomBlockPackageEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectPath.value = 'D:/Demo'
    mocks.readProjectCustomBlockPackage.mockResolvedValue(packageResult)
    mocks.getProjectCustomBlockImportConflict.mockResolvedValue(null)
    mocks.registerProjectCustomBlockFile.mockResolvedValue({
      source: 'assets/blocks/square.ocblock',
      copied: true,
    })
  })

  it('validates and displays package metadata without registering automatically', async () => {
    const wrapper = mount(CustomBlockPackageEditor, {
      props: { filePath: 'D:/Downloads/square.ocblock' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Square')
    expect(wrapper.text()).toContain('interface-hash')
    expect(wrapper.text()).toContain('Size')
    expect(wrapper.text()).toContain('resources/images/logo.png')
    expect(mocks.registerProjectCustomBlockFile).not.toHaveBeenCalled()
  })

  it('requires an explicit same-name conflict choice before registration', async () => {
    mocks.getProjectCustomBlockImportConflict.mockResolvedValue({
      existingSource: 'assets/blocks/square.ocblock',
      availableCopySource: 'assets/blocks/square (2).ocblock',
    })
    const wrapper = mount(CustomBlockPackageEditor, {
      props: { filePath: 'D:/Downloads/square.ocblock' },
    })
    await flushPromises()

    await wrapper.get('.custom-block-package-editor__actions button').trigger('click')
    await flushPromises()
    expect(mocks.registerProjectCustomBlockFile).not.toHaveBeenCalled()
    await wrapper.getComponent(OcOptionGroup).findAll('[role="radio"]')[1]!.trigger('click')
    await wrapper.get('.custom-block-package-editor__actions button').trigger('click')
    await flushPromises()

    expect(mocks.registerProjectCustomBlockFile).toHaveBeenCalledWith(
      'D:/Downloads/square.ocblock',
      'use-existing',
    )
  })

  it('disables registration until a project is open', async () => {
    mocks.projectPath.value = ''
    const wrapper = mount(CustomBlockPackageEditor, {
      props: { filePath: 'D:/Downloads/square.ocblock' },
    })
    await flushPromises()

    expect(wrapper.getComponent(OcButton).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('customBlockPackage.projectRequired')
  })

  it('reuses package details without registration controls in observe-only mode', async () => {
    const wrapper = mount(CustomBlockPackageEditor, {
      props: {
        filePath: 'D:/snapshot/assets/blocks/square.ocblock',
        resourceRootPath: 'D:/snapshot',
        access: 'observe-only',
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Square')
    expect(wrapper.text()).toContain('assets/blocks/square.ocblock')
    expect(wrapper.text()).not.toContain('D:/snapshot')
    expect(wrapper.findComponent(OcButton).exists()).toBe(false)
    expect(wrapper.find('.custom-block-package-editor__actions').exists()).toBe(false)
  })
})
