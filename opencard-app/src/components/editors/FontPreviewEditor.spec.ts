import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FontPreviewEditor from './FontPreviewEditor.vue'

const fontSet = {
  add: vi.fn(),
  delete: vi.fn(),
}
const mocks = vi.hoisted(() => ({
  readBinaryFile: vi.fn(),
  createObjectURL: vi.fn(),
  revokeObjectURL: vi.fn(),
}))

class FontFaceMock {
  constructor(
    readonly family: string,
    readonly source: string,
  ) {}

  async load(): Promise<this> {
    return this
  }
}

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { readBinaryFile: mocks.readBinaryFile },
}))

describe('FontPreviewEditor', () => {
  beforeEach(() => {
    vi.stubGlobal('FontFace', FontFaceMock)
    Object.defineProperty(document, 'fonts', { configurable: true, value: fontSet })
    vi.stubGlobal('URL', {
      createObjectURL: mocks.createObjectURL,
      revokeObjectURL: mocks.revokeObjectURL,
    })
    vi.clearAllMocks()
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1, 2, 3]))
    mocks.createObjectURL.mockReturnValue('blob:font-preview')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the font for the session and removes it when the preview closes', async () => {
    const wrapper = mount(FontPreviewEditor, {
      props: {
        filePath: 'assets/Brand.otf',
        fileName: 'Brand.otf',
        resourceRootPath: 'D:/project',
      },
    })
    await flushPromises()

    expect(mocks.readBinaryFile).toHaveBeenCalledWith('D:/project/assets/Brand.otf')
    expect((mocks.createObjectURL.mock.calls[0]![0] as Blob).type).toBe('font/otf')
    expect(fontSet.add).toHaveBeenCalledWith(expect.objectContaining({
      source: 'url("blob:font-preview")',
    }))
    const input = wrapper.get('textarea')
    expect(input.attributes('style')).toContain('OpenCardFontPreview-')
    expect((input.element as HTMLTextAreaElement).value).toBe('fontPreview.sample')
    expect(wrapper.find('.font-preview-editor__reference').exists()).toBe(false)
    await input.setValue('自定义试字 OpenCard')
    expect((input.element as HTMLTextAreaElement).value).toBe('自定义试字 OpenCard')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.emitted('modified')).toEqual([[false]])

    const loadedFace = fontSet.add.mock.calls[0]![0]
    wrapper.unmount()
    expect(fontSet.delete).toHaveBeenCalledWith(loadedFace)
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:font-preview')
  })
})
