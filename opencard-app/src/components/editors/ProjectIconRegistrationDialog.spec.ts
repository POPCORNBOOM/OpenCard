import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectIconRegistrationDialog from './ProjectIconRegistrationDialog.vue'
import OcButton from '../base/OcButton.vue'

const mocks = vi.hoisted(() => ({ pickFile: vi.fn(), resolveImportConflict: vi.fn() }))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
}))

describe('ProjectIconRegistrationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveImportConflict.mockResolvedValue(null)
  })

  it('registers an external image with a filename-derived name and copy directory', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/Status Icons.PNG')
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        defaultDirectory: 'assets/icons',
        defaultOpenPath: 'D:/Project',
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'D:/Project' }))
    expect(wrapper.findAll('input')[0]!.element.value).toBe('Status Icons')
    expect(wrapper.findAll('input')[1]!.element.value).toBe('status-icons')
    expect(wrapper.text()).toContain('projectConfig.icons.copyIntoProject')
    expect(wrapper.findAll('input')[3]!.element.value).toBe('assets/icons')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      name: 'Status Icons',
      key: 'status-icons',
      sourcePath: 'D:/Downloads/Status Icons.PNG',
      targetDirectory: 'assets/icons',
    })
  })

  it('registers a project image directly and resolves duplicate names', async () => {
    mocks.pickFile.mockResolvedValue('D:/Project/assets/icons/status.png')
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        series: [{ name: 'Existing status', key: 'status', source: 'assets/icons/status.png', icons: [] }],
        defaultDirectory: 'assets/icons',
        getRelativeProjectPath: () => 'assets/icons/status.png',
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('input')[0]!.element.value).toBe('status')
    expect(wrapper.findAll('input')[1]!.element.value).toBe('status-2')
    expect(wrapper.text()).toContain('projectConfig.icons.registerProjectFile')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      name: 'status',
      key: 'status-2',
      sourcePath: 'D:/Project/assets/icons/status.png',
    })
  })

  it('can use an existing same-name project image', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/status.png')
    mocks.resolveImportConflict.mockResolvedValue({
      existingSource: 'assets/icons/status.png',
      availableCopySource: 'assets/icons/status (2).png',
    })
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        defaultDirectory: 'assets/icons',
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(2)
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      conflictResolution: 'use-existing',
      targetDirectory: 'assets/icons',
    })
  })
})
