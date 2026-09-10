import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import ProjectCoverField from './ProjectCoverField.vue'
import OcButton from '../base/OcButton.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  fileExists: vi.fn(),
  copyFile: vi.fn(),
  writeFile: vi.fn(),
  notifyError: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key}:${JSON.stringify(params)}` : key) }),
}))
vi.mock('@tauri-apps/api/core', () => ({ convertFileSrc: (path: string) => `asset://${path}` }))
vi.mock('../../features/notifications/titlebarNotices', () => ({ notifyError: mocks.notifyError }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: {
    pickFile: mocks.pickFile,
    fileExists: mocks.fileExists,
    copyFile: mocks.copyFile,
    writeFile: mocks.writeFile,
  },
}))
vi.mock('../../features/workspace/store/projectStore', () => ({
  useProjectStore: () => ({ fileChangeRevision: ref(0) }),
}))

function mountField(modelValue = '') {
  return mount(ProjectCoverField, {
    props: { modelValue, projectRootPath: 'D:/Project' },
  })
}

function removeButton(wrapper: ReturnType<typeof mountField>) {
  return wrapper.findAllComponents(OcButton)[0]!
}

/** jsdom 里需要显式触发 input 事件，输入框才会把值交给组件。 */
async function type(wrapper: ReturnType<typeof mountField>, value: string) {
  const input = wrapper.get('input')
  ;(input.element as HTMLInputElement).value = value
  await input.trigger('input')
  return input
}

describe('ProjectCoverField', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fileExists.mockResolvedValue(false)
  })

  it('previews the cover image in a full-width banner', async () => {
    mocks.fileExists.mockResolvedValue(true)
    const wrapper = mountField('assets/cover.png')
    await flushPromises()

    expect(wrapper.get('.project-cover-field__banner img').attributes('src'))
      .toBe('asset://D:/Project/assets/cover.png')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('assets/cover.png')
    expect(wrapper.get('.project-cover-field__banner').attributes('data-tooltip')).toBe('projectConfig.cover.replaceHint')
    expect(wrapper.text()).not.toContain('projectConfig.cover.missing')
  })

  it('hints the empty state and only offers removal once a cover is set', () => {
    const empty = mountField('')
    expect(empty.get('.project-cover-field__banner').attributes('data-tooltip')).toBe('projectConfig.cover.chooseHint')
    expect(empty.text()).toContain('projectConfig.cover.empty')
    expect(empty.findAllComponents(OcButton)).toHaveLength(0)

    expect(mountField('assets/cover.png').findAllComponents(OcButton)).toHaveLength(1)
  })

  it('explains an unusable cover as state instead of failing the field', async () => {
    const missing = mountField('assets/cover.png')
    await flushPromises()
    expect(missing.text()).toContain('projectConfig.cover.missing')
    expect(mocks.notifyError).not.toHaveBeenCalled()

    const unsupported = mountField('assets/cover.txt')
    await flushPromises()
    expect(unsupported.text()).toContain('projectConfig.cover.unsupported')
    expect(unsupported.find('.project-cover-field__banner img').exists()).toBe(false)
    expect(mocks.notifyError).not.toHaveBeenCalled()
  })

  it('stores a typed project-relative path without touching the file system', async () => {
    const wrapper = mountField('')

    const partial = await type(wrapper, 'assets\\hero')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    const complete = await type(wrapper, 'assets\\hero.webp')
    await complete.trigger('change')

    expect(partial).toBeDefined()
    expect(wrapper.emitted('update:modelValue')).toEqual([['assets/hero.webp']])
    expect(mocks.copyFile).not.toHaveBeenCalled()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })

  it('reports an unusable typed path through the title bar and restores the stored value', async () => {
    const wrapper = mountField('assets/cover.png')

    const input = await type(wrapper, '../outside.png')
    await input.trigger('change')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(mocks.notifyError).toHaveBeenCalledWith('projectConfig.cover.invalidPath:{"path":"../outside.png"}')
    expect((input.element as HTMLInputElement).value).toBe('assets/cover.png')
  })

  it('picks an image inside the project through the banner', async () => {
    const wrapper = mountField('')
    mocks.pickFile.mockResolvedValue('D:/Project/assets/cover.png')

    await wrapper.get('.project-cover-field__banner').trigger('click')
    await flushPromises()

    expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'D:/Project',
      extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif'],
    }))
    expect(wrapper.emitted('update:modelValue')).toEqual([['assets/cover.png']])
    expect(mocks.notifyError).not.toHaveBeenCalled()
  })

  it('refuses a pick outside the project through the title bar without copying files', async () => {
    const wrapper = mountField('assets/cover.png')
    mocks.pickFile.mockResolvedValue('D:/Downloads/cover.png')

    await wrapper.get('.project-cover-field__banner').trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(mocks.notifyError).toHaveBeenCalledWith('projectConfig.cover.outsideProject')
    expect(mocks.copyFile).not.toHaveBeenCalled()
  })

  it('clears the reference on remove without deleting any file', async () => {
    const wrapper = mountField('assets/cover.png')

    await removeButton(wrapper).trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['']])
    expect(mocks.copyFile).not.toHaveBeenCalled()
    expect(mocks.writeFile).not.toHaveBeenCalled()
  })
})
