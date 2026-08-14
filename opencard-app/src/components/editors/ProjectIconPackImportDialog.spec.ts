import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectIconPackImportDialog from './ProjectIconPackImportDialog.vue'
import OcButton from '../base/OcButton.vue'

const mocks = vi.hoisted(() => ({ pickFile: vi.fn(), readProjectIconPack: vi.fn() }))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
}))
vi.mock('../../features/workspace/services/projectIconPack', () => ({
  readProjectIconPack: mocks.readProjectIconPack,
}))

describe('ProjectIconPackImportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pickFile.mockResolvedValue('D:/Downloads/Status Icons.ociconpack')
    mocks.readProjectIconPack.mockResolvedValue({
      manifest: {
        type: 'opencard-icon-pack', schemaVersion: '1', name: 'Status Icons', key: 'status-icons',
        spritesheet: 'spritesheet.png', icons: [],
      },
      spritesheetBytes: new Uint8Array([1]),
    })
  })

  it('derives the name immediately and keeps the suggested key as a placeholder', async () => {
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
})
