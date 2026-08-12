import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectIconRegistrationDialog from './ProjectIconRegistrationDialog.vue'
import OcButton from '../base/OcButton.vue'
import OcOptionGroup from '../standard/OcOptionGroup.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(), pickFiles: vi.fn(), compose: vi.fn(), resolveImportConflict: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile, pickFiles: mocks.pickFiles },
}))
vi.mock('../../features/workspace/services/projectIconSpritesheetComposer', () => ({
  composeProjectIconSpritesheet: mocks.compose,
}))

enableAutoUnmount(afterEach)

describe('ProjectIconRegistrationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveImportConflict.mockResolvedValue(null)
    mocks.compose.mockResolvedValue({
      bytes: new Uint8Array([1, 2]), width: 32, height: 16,
      icons: [{ iconKey: 'warning', name: 'Warning', x: 2, y: 2, width: 8, height: 8 }],
    })
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

    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()
    expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'D:/Project' }))
    expect(wrapper.findAll('input')[0]!.element.value).toBe('D:/Downloads/Status Icons.PNG')
    expect(wrapper.findAll('input')[1]!.element.value).toBe('Status Icons')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('')
    expect(wrapper.findAll('input')[2]!.attributes('placeholder')).toBe('status-icons')
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

  it('always uses automatic packing without configuration controls', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Images/Warning.png'])
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        defaultDirectory: 'assets/icons',
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })
    wrapper.getComponent(OcOptionGroup).vm.$emit('update:modelValue', 'images')
    await wrapper.vm.$nextTick()
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseImages')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('details').exists()).toBe(false)
    expect(wrapper.find('[data-tooltip="projectConfig.icons.automaticPackingHelp"]').exists()).toBe(true)
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
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('input')[0]!.element.value).toBe('D:/Project/assets/icons/status.png')
    expect(wrapper.findAll('input')[1]!.element.value).toBe('status')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('')
    expect(wrapper.findAll('input')[2]!.attributes('placeholder')).toBe('status-2')
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

    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.project-icon-registration-dialog__conflict [role="radio"]')).toHaveLength(2)
    await wrapper.findAll('.project-icon-registration-dialog__conflict [role="radio"]')[1]!.trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      conflictResolution: 'use-existing',
      targetDirectory: 'assets/icons',
    })
  })

  it('composes multiple selected images before submitting the generated spritesheet', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Images/Warning.png', 'D:/Images/Info.png'])
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        defaultDirectory: 'assets/icons',
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    wrapper.getComponent(OcOptionGroup).vm.$emit('update:modelValue', 'images')
    await wrapper.vm.$nextTick()
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseImages')!.trigger('click')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(mocks.compose).toHaveBeenCalledWith([
      { path: 'D:/Images/Warning.png', name: 'Warning', iconKey: 'warning' },
      { path: 'D:/Images/Info.png', name: 'Info', iconKey: 'info' },
    ])
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      generatedSpritesheet: expect.objectContaining({ fileName: 'spritesheet.png' }),
      targetDirectory: 'assets/icons',
    })
  })

  it('debounces the composition preview and reuses its completed result on submit', async () => {
    vi.useFakeTimers()
    try {
      mocks.pickFiles.mockResolvedValue(['D:/Images/Warning.png'])
      const wrapper = mount(ProjectIconRegistrationDialog, {
        props: {
          open: true,
          defaultDirectory: 'assets/icons',
          getRelativeProjectPath: () => null,
          resolveImportConflict: mocks.resolveImportConflict,
        },
        global: { stubs: { Teleport: true } },
      })
      wrapper.getComponent(OcOptionGroup).vm.$emit('update:modelValue', 'images')
      await wrapper.vm.$nextTick()
      await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseImages')!.trigger('click')
      await flushPromises()
      expect(mocks.compose).not.toHaveBeenCalled()

      await vi.advanceTimersByTimeAsync(200)
      expect(mocks.compose).toHaveBeenCalledTimes(1)
      await wrapper.get('form').trigger('submit')
      await flushPromises()
      expect(mocks.compose).toHaveBeenCalledTimes(1)
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
