import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('ProjectIconRegistrationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveImportConflict.mockResolvedValue(null)
    mocks.compose.mockResolvedValue({
      bytes: new Uint8Array([1, 2]), width: 32, height: 16,
      icons: [{ iconKey: 'warning', name: 'Warning', x: 2, y: 2, width: 8, height: 8 }],
    })
  })

  it('registers an external image with a filename-derived name', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/Status Icons.PNG')
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        defaultOpenPath: 'D:/Project',
        getManagedIconSource: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()
    expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'D:/Project' }))
    expect(wrapper.text()).toContain('Status Icons.PNG')
    expect(wrapper.text()).toContain('Status Icons / status-icons')
    expect(wrapper.findComponent(OcOptionGroup).exists()).toBe(false)
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.advancedSettings')!.trigger('click')
    expect(wrapper.text()).toContain('projectConfig.icons.copyIntoProject')
    expect(wrapper.findComponent(OcOptionGroup).exists()).toBe(true)
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.simpleSettings')!.trigger('click')
    expect(wrapper.findComponent(OcOptionGroup).exists()).toBe(false)

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      name: 'Status Icons',
      key: 'status-icons',
      sourcePath: 'D:/Downloads/Status Icons.PNG',
    })
  })

  it('opens the managed icon directory immediately when requested', async () => {
    mocks.pickFile.mockResolvedValue('D:/Project/.opencard/icons/status.png')
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        selectFileOnOpen: true,
        defaultOpenPath: 'D:/Project/.opencard/icons',
        getManagedIconSource: () => 'icons/status.png',
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })
    await flushPromises()

    expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'D:/Project/.opencard/icons',
    }))
    expect(wrapper.text()).toContain('status.png')
  })

  it('always uses automatic packing without configuration controls', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Images/Warning.png'])
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        getManagedIconSource: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.advancedSettings')!.trigger('click')
    wrapper.getComponent(OcOptionGroup).vm.$emit('update:modelValue', 'images')
    await wrapper.vm.$nextTick()
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseImages')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('details').exists()).toBe(false)
    expect(wrapper.find('[data-tooltip="projectConfig.icons.automaticPackingHelp"]').exists()).toBe(true)
  })

  it('registers a project image directly and resolves duplicate names', async () => {
    mocks.pickFile.mockResolvedValue('D:/Project/.opencard/icons/status.png')
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        series: [{ name: 'Existing status', key: 'status', source: 'icons/status.png', icons: [] }],
        getManagedIconSource: () => 'icons/status.png',
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('status.png')
    expect(wrapper.text()).toContain('status / status-2')
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.advancedSettings')!.trigger('click')
    expect(wrapper.text()).toContain('projectConfig.icons.registerProjectFile')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      name: 'status',
      key: 'status-2',
      sourcePath: 'D:/Project/.opencard/icons/status.png',
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
        getManagedIconSource: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()
    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.advancedSettings')!.trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.findAll('.project-icon-registration-dialog__conflict [role="radio"]')).toHaveLength(2)
    await wrapper.findAll('.project-icon-registration-dialog__conflict [role="radio"]')[1]!.trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      conflictResolution: 'use-existing',
    })
  })

  it('shows a failed import preflight without permanently disabling confirmation', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/status.png')
    mocks.resolveImportConflict.mockRejectedValue(new Error('preflight failed'))
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        getManagedIconSource: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.chooseFile')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('projectConfig.importConflict.checkFailedWithReason')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })

  it('composes multiple selected images before submitting the generated spritesheet', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Images/Warning.png', 'D:/Images/Info.png'])
    const wrapper = mount(ProjectIconRegistrationDialog, {
      props: {
        open: true,
        getManagedIconSource: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.advancedSettings')!.trigger('click')
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
    })
  })

  it('debounces the composition preview and reuses its completed result on submit', async () => {
    vi.useFakeTimers()
    try {
      mocks.pickFiles.mockResolvedValue(['D:/Images/Warning.png'])
      const wrapper = mount(ProjectIconRegistrationDialog, {
        props: {
          open: true,
          getManagedIconSource: () => null,
          resolveImportConflict: mocks.resolveImportConflict,
        },
        global: { stubs: { Teleport: true } },
      })
      await wrapper.findAllComponents(OcButton).find(button => button.text() === 'projectConfig.icons.advancedSettings')!.trigger('click')
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
