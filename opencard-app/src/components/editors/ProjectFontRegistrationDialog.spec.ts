import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProjectFontRegistrationDialog from './ProjectFontRegistrationDialog.vue'
import OcButton from '../base/OcButton.vue'

const mocks = vi.hoisted(() => ({
  pickFile: vi.fn(),
  pickFiles: vi.fn(),
  readBinaryFile: vi.fn(),
  inspectProjectFontSource: vi.fn(),
  resolveImportConflict: vi.fn(),
}))

vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../../features/workspace/services/fileSystemService', () => ({
  fileSystemService: {
    pickFile: mocks.pickFile,
    pickFiles: mocks.pickFiles,
    readBinaryFile: mocks.readBinaryFile,
  },
}))
vi.mock('../../features/workspace/services/projectFontMetadata', () => ({
  inspectProjectFontSource: mocks.inspectProjectFontSource,
}))

const face = (source: string, weight = 400) => ({
  source,
  weight: { min: weight, max: weight },
  stretch: { min: 100, max: 100 },
  style: { kind: 'normal' as const },
})
const registryEntry = (key: string, name: string, sources: readonly string[]) => ({
  kind: 'family' as const,
  name,
  family: { key, name, faces: sources.map(source => face(source)) },
})

function mountDialog(extra: Record<string, unknown> = {}) {
  return mount(ProjectFontRegistrationDialog, {
    props: {
      open: true,
      registry: {},
      getManagedFontSource: () => null,
      resolveImportConflict: mocks.resolveImportConflict,
      ...extra,
    },
    global: { stubs: { Teleport: true } },
  })
}

function button(wrapper: ReturnType<typeof mountDialog>, text: string) {
  return wrapper.findAllComponents(OcButton).find(candidate => candidate.text() === text)!
}

describe('ProjectFontRegistrationDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readBinaryFile.mockResolvedValue(new Uint8Array([1]))
    mocks.inspectProjectFontSource.mockResolvedValue([{
      familyName: 'Brand Sans',
      faceName: 'Regular',
      weight: { min: 400, max: 400 },
      stretch: { min: 100, max: 100 },
      style: { kind: 'normal' },
    }])
    mocks.resolveImportConflict.mockResolvedValue(null)
  })

  it('requires at least one face file', () => {
    const wrapper = mountDialog()
    expect(wrapper.text()).toContain('projectConfig.fonts.faceRequired')
    expect(button(wrapper, 'projectConfig.fonts.confirmRegister').props('disabled')).toBe(true)
  })

  it('builds one family from multiple face files and exposes descriptors through advanced controls', async () => {
    mocks.pickFiles.mockResolvedValue([
      'D:/Downloads/Brand-Regular.woff2',
      'D:/Downloads/Brand-Bold.woff2',
    ])
    mocks.inspectProjectFontSource
      .mockResolvedValueOnce([{
        familyName: 'Brand Sans', faceName: 'Regular',
        weight: { min: 400, max: 400 }, stretch: { min: 100, max: 100 }, style: { kind: 'normal' },
      }])
      .mockResolvedValueOnce([{
        familyName: 'Brand Sans', faceName: 'Bold',
        weight: { min: 700, max: 700 }, stretch: { min: 100, max: 100 }, style: { kind: 'normal' },
      }])
    const wrapper = mountDialog()

    await button(wrapper, 'projectConfig.fonts.addFace').trigger('click')
    await flushPromises()
    await wrapper.findAll('input')[1]!.setValue('brand-sans')
    await button(wrapper, 'projectConfig.fonts.advancedFace').trigger('click')
    const numbers = wrapper.findAll('input[type="number"]')
    await numbers[0]!.setValue('700')
    await numbers[1]!.setValue('700')

    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      families: [{
        key: 'brand-sans',
        name: 'Brand Sans',
        faces: [
        {
          sourcePath: 'D:/Downloads/Brand-Regular.woff2',
          weight: { min: 400, max: 400 },
          stretch: { min: 100, max: 100 },
          style: { kind: 'normal' },
        },
        {
          sourcePath: 'D:/Downloads/Brand-Bold.woff2',
          weight: { min: 700, max: 700 },
          stretch: { min: 100, max: 100 },
          style: { kind: 'normal' },
        },
        ],
      }],
    })
  })

  it('edits and removes existing family faces without re-importing retained sources', async () => {
    const wrapper = mountDialog({
      registry: {
        brand: registryEntry('brand', 'Brand', ['fonts/Regular.woff2', 'fonts/Bold.woff2']),
      },
      originalKey: 'brand',
    })
    const removeButtons = wrapper.findAll('[aria-label="projectConfig.fonts.removeFace"]')
    await removeButtons[1]!.trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toEqual({
      families: [{
        originalKey: 'brand',
        key: 'brand',
        name: 'Brand',
        faces: [{
          originalSource: 'fonts/Regular.woff2',
          sourcePath: 'fonts/Regular.woff2',
          weight: { min: 400, max: 400 },
          stretch: { min: 100, max: 100 },
          style: { kind: 'normal' },
        }],
      }],
    })
  })

  it('prevents case-insensitive family and composition key collisions', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Downloads/Body.woff2'])
    const wrapper = mountDialog({
      registry: { brand: registryEntry('brand', 'Brand', ['fonts/Brand.woff2']) },
      reservedKeys: ['body'],
    })
    await button(wrapper, 'projectConfig.fonts.addFace').trigger('click')
    await flushPromises()
    await wrapper.findAll('input')[1]!.setValue('BRAND')
    expect(wrapper.text()).toContain('projectConfig.fonts.keyExists')
    await wrapper.findAll('input')[1]!.setValue('BODY')
    expect(button(wrapper, 'projectConfig.fonts.confirmRegister').props('disabled')).toBe(true)
  })

  it('requires an import conflict choice for each external face', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Downloads/Brand.woff2'])
    mocks.resolveImportConflict.mockResolvedValue({
      existingSource: 'fonts/Brand.woff2',
      availableCopySource: 'fonts/Brand (2).woff2',
    })
    const wrapper = mountDialog()
    await button(wrapper, 'projectConfig.fonts.addFace').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[role="radio"]')).toHaveLength(2)
    expect(button(wrapper, 'projectConfig.fonts.confirmRegister').props('disabled')).toBe(true)
    await wrapper.get('[role="radio"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      families: [{ faces: [{ conflictResolution: 'rename-copy' }] }],
    })
  })

  it('groups a multi-file selection by the embedded family name', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Alpha.ttf', 'D:/Beta.ttf'])
    mocks.inspectProjectFontSource
      .mockResolvedValueOnce([{
        familyName: 'Alpha Sans', faceName: 'Regular',
        weight: { min: 400, max: 400 }, stretch: { min: 100, max: 100 }, style: { kind: 'normal' },
      }])
      .mockResolvedValueOnce([{
        familyName: 'Beta Serif', faceName: 'Regular',
        weight: { min: 400, max: 400 }, stretch: { min: 100, max: 100 }, style: { kind: 'normal' },
      }])
    const wrapper = mountDialog()
    await button(wrapper, 'projectConfig.fonts.addFace').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Alpha Sans')
    expect(wrapper.text()).toContain('Beta Serif')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      families: [
        { key: 'alpha-sans', name: 'Alpha Sans' },
        { key: 'beta-serif', name: 'Beta Serif' },
      ],
    })
  })

  it('keeps TTC member selection transient and emits only selected members', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Collection.ttc'])
    mocks.inspectProjectFontSource.mockResolvedValue([{
      collectionIndex: 0,
      familyName: 'Collection Sans',
      faceName: 'Regular',
      weight: { min: 400, max: 400 }, stretch: { min: 100, max: 100 }, style: { kind: 'normal' },
    }, {
      collectionIndex: 1,
      familyName: 'Collection Sans',
      faceName: 'Bold',
      weight: { min: 700, max: 700 }, stretch: { min: 100, max: 100 }, style: { kind: 'normal' },
    }])
    const wrapper = mountDialog()
    await button(wrapper, 'projectConfig.fonts.addFace').trigger('click')
    await flushPromises()
    await wrapper.findAll('[aria-label="projectConfig.fonts.removeFace"]')[0]!.trigger('click')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      families: [{
        faces: [{ collectionIndex: 1, weight: { min: 700, max: 700 } }],
      }],
    })
  })

  it('blocks ambiguous face descriptor overlap', async () => {
    mocks.pickFiles.mockResolvedValue(['D:/Regular.ttf', 'D:/Alternate.ttf'])
    const wrapper = mountDialog()
    await button(wrapper, 'projectConfig.fonts.addFace').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('projectConfig.fonts.overlappingFaces')
    expect(button(wrapper, 'projectConfig.fonts.confirmRegister').props('disabled')).toBe(true)
  })
})
