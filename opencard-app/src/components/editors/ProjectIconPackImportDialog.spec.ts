import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectIconPackImportDialog from './ProjectIconPackImportDialog.vue'
import OcButton from '../base/OcButton.vue'

const mocks = vi.hoisted(() => ({ pickFile: vi.fn() }))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
}))

describe('ProjectIconPackImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pickFile.mockResolvedValue('D:/Downloads/Status Icons.ociconpack')
  })

  it('derives the name from the file and keeps the suggested key as a placeholder', async () => {
    const wrapper = mount(ProjectIconPackImportDialog, {
      props: { open: true },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()

    expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({ extensions: ['ociconpack'] }))
    expect(wrapper.findAll('input')[0]!.element.value).toBe('D:/Downloads/Status Icons.ociconpack')
    expect(wrapper.findAll('input')[1]!.element.value).toBe('Status Icons')
    expect(wrapper.findAll('input')[2]!.element.value).toBe('')
    expect(wrapper.findAll('input')[2]!.attributes('placeholder')).toBe('status-icons')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      packPath: 'D:/Downloads/Status Icons.ociconpack',
      name: 'Status Icons',
      key: 'status-icons',
    })
  })

  it('validates the Key without unpacking the archive first', async () => {
    const wrapper = mount(ProjectIconPackImportDialog, {
      props: { open: true, series: [{ name: 'Status Icons', key: 'status-icons', icons: [] }] },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    // A derived Key avoids the collision, so the conflict only appears once the user types it.
    await wrapper.findAll('input')[2]!.setValue('status-icons')
    // The archive is only read by the owner inside the global progress task, never here: this dialog
    // is not even given a file-system service that could read it.
    expect(wrapper.text()).toContain('projectConfig.icons.iconSetKeyExists')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
  })
})
