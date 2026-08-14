import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectFontRegistrationDialog from './ProjectFontRegistrationDialog.vue'
import OcButton from '../base/OcButton.vue'

const mocks = vi.hoisted(() => ({ pickFile: vi.fn(), resolveImportConflict: vi.fn() }))
const registryEntry = (key: string, name: string, source: string) => ({
  kind: 'family' as const,
  name,
  family: {
    key,
    name,
    faces: [{
      source,
      weight: { min: 400, max: 400 },
      stretch: { min: 100, max: 100 },
      style: { kind: 'normal' as const },
    }],
  },
})

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: { pickFile: mocks.pickFile },
}))

describe('ProjectFontRegistrationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveImportConflict.mockResolvedValue(null)
  })

  it('asks for a font file before validating generated font details', () => {
    const wrapper = mount(ProjectFontRegistrationDialog, {
      props: {
        open: true,
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    expect(wrapper.text()).toContain('projectConfig.fonts.fileRequired')
    expect(wrapper.text()).not.toContain('projectConfig.fonts.nameRequired')
    expect(wrapper.findAll('input')[0]!.attributes('aria-invalid')).toBe('true')
  })

  it('registers one external font with its name and key', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/BrandSans-BoldItalic.woff2')
    const wrapper = mount(ProjectFontRegistrationDialog, {
      props: {
        open: true,
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()

    expect(wrapper.findAll('input')[1]!.element.value).toBe('BrandSans-BoldItalic')
    await wrapper.findAll('input')[1]!.setValue('Brand Sans Bold Italic')
    await wrapper.findAll('input')[2]!.setValue('brand-sans-bold-italic')

    expect(wrapper.text()).toContain('projectConfig.fonts.copyIntoProject')
    const buttons = wrapper.findAllComponents(OcButton)
    expect(buttons[buttons.length - 1]!.text()).toBe('projectConfig.fonts.confirmRegister')
    expect(buttons[buttons.length - 1]!.props('disabled')).toBe(false)

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      key: 'brand-sans-bold-italic',
      name: 'Brand Sans Bold Italic',
      sourcePath: 'D:/Downloads/BrandSans-BoldItalic.woff2',
      weight: { min: 400, max: 400 },
      stretch: { min: 100, max: 100 },
      style: { kind: 'normal' },
    })
  })

  it('configures an existing project font without requiring another file import', async () => {
    const wrapper = mount(ProjectFontRegistrationDialog, {
      props: {
        open: true,
        registry: {
          'brand-sans': registryEntry('brand-sans', 'Brand Sans', 'fonts/BrandSans.woff2'),
        },
        originalKey: 'brand-sans',
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAll('input')[1]!.setValue('Brand Display')
    await wrapper.findAll('input')[2]!.setValue('brand-display')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      originalKey: 'brand-sans',
      key: 'brand-display',
      name: 'Brand Display',
      sourcePath: 'fonts/BrandSans.woff2',
      weight: { min: 400, max: 400 },
      stretch: { min: 100, max: 100 },
      style: { kind: 'normal' },
    })
  })

  it('prevents case-insensitive key collisions', async () => {
    mocks.pickFile.mockResolvedValue('D:/Project/assets/fonts/Body.woff2')
    const wrapper = mount(ProjectFontRegistrationDialog, {
      props: {
        open: true,
        registry: { brand: registryEntry('brand', 'Brand', 'fonts/Brand.woff2') },
        getRelativeProjectPath: () => 'assets/fonts/Body.woff2',
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('input')[2]!.setValue('BRAND')
    expect(wrapper.text()).toContain('projectConfig.fonts.keyExists')
    const buttons = wrapper.findAllComponents(OcButton)
    expect(buttons[buttons.length - 1]!.props('disabled')).toBe(true)
  })

  it('allows another registration to use the same project font file', async () => {
    mocks.pickFile.mockResolvedValue('D:/Project/assets/fonts/Brand.woff2')
    const wrapper = mount(ProjectFontRegistrationDialog, {
      props: {
        open: true,
        registry: { brand: registryEntry('brand', 'Brand', 'fonts/Brand.woff2') },
        getRelativeProjectPath: () => 'assets/fonts/Brand.woff2',
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    await wrapper.findAll('input')[1]!.setValue('Brand Alternate')
    await wrapper.findAll('input')[2]!.setValue('brand-alternate')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      key: 'brand-alternate',
      sourcePath: 'D:/Project/assets/fonts/Brand.woff2',
    })
  })

  it('requires a choice when the target contains a same-name file', async () => {
    mocks.pickFile.mockResolvedValue('D:/Downloads/Brand.woff2')
    mocks.resolveImportConflict.mockResolvedValue({
      existingSource: 'assets/fonts/Brand.woff2',
      availableCopySource: 'assets/fonts/Brand (11).woff2',
    })
    const wrapper = mount(ProjectFontRegistrationDialog, {
      props: {
        open: true,
        getRelativeProjectPath: () => null,
        resolveImportConflict: mocks.resolveImportConflict,
      },
      global: { stubs: { Teleport: true } },
    })

    await wrapper.findAllComponents(OcButton)[0]!.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('projectConfig.importConflict.message')
    expect(wrapper.findAll('[role="radio"]')).toHaveLength(2)
    const buttons = wrapper.findAllComponents(OcButton)
    const submit = buttons[buttons.length - 1]!
    expect(submit.props('disabled')).toBe(true)

    await wrapper.get('[role="radio"]').trigger('click')
    expect(submit.props('disabled')).toBe(false)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      conflictResolution: 'rename-copy',
    })
  })
})
