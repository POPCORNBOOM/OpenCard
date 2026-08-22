import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createBlock } from '../../entities/card/model'
import type { CardRenderEnvironment } from '../../features/card-rendering/renderPipeline'
import type {
  ProjectCustomBlockCatalog,
  ProjectCustomBlockCatalogEntry,
  ProjectCustomBlockManifestCatalog,
} from '../../features/workspace/model/projectCustomBlocks'
import { EMPTY_PROJECT_ICON_CATALOG } from '../../features/workspace/services/projectIconCatalog'
import type { ProjectResourceEnvironment } from '../../features/workspace/services/projectResourceEnvironment'
import { useCustomBlockPreview } from './useCustomBlockPreview'

function createEnvironment(packageId: string): ProjectResourceEnvironment {
  return {
    kind: 'package',
    namespace: `package-${packageId.replace('/', '-')}`,
    rootPath: `D:/Project/.opencard/blocks/${packageId}/resources`,
    fontDocument: { families: [], compositions: [] },
    fonts: {},
    iconDocument: { iconSeries: [] },
    iconCatalog: EMPTY_PROJECT_ICON_CATALOG,
    issues: [],
    customBlockCatalog: new Map(),
  }
}

function createEntry(packageId: string): ProjectCustomBlockCatalogEntry {
  const root = createBlock('text-block', { id: `${packageId}-root`, content: '{{self:label}}' })
  root.additionalFieldDefinition = {
    label: { fieldType: 'string', title: 'Label' },
    count: { fieldType: 'number', title: 'Count' },
    enabled: { fieldType: 'boolean', title: 'Enabled' },
    color: { fieldType: 'color', title: 'Color' },
  }
  return {
    installationPath: `D:/Project/.opencard/blocks/${packageId}`,
    resourceRootPath: `D:/Project/.opencard/blocks/${packageId}/resources`,
    manifest: {
      type: 'opencard-custom-block',
      packageId,
      version: '0.1.0',
      name: packageId.toUpperCase(),
      publicFieldKeys: ['label', 'count', 'enabled', 'color', 'content'],
    },
    block: Object.assign(root, { label: 'Ready' }),
  }
}

function createHarness(initialCatalog = true) {
  const first = createEntry('alice/first')
  const second = createEntry('alice/second')
  const catalog = ref<ProjectCustomBlockCatalog>(initialCatalog
    ? new Map([['alice/first', first], ['alice/second', second]])
    : new Map())
  const environments = new Map([
    ['alice/first', createEnvironment('alice/first')],
    ['alice/second', createEnvironment('alice/second')],
  ])
  const runtimeCatalog = new Map([
    ['alice/first', { manifest: first.manifest, block: first.block, environment: environments.get('alice/first')!, dependencies: new Map() }],
    ['alice/second', { manifest: second.manifest, block: second.block, environment: environments.get('alice/second')!, dependencies: new Map() }],
  ])
  const renderEnvironment = ref<CardRenderEnvironment>({
    project: null,
    dictionary: null,
    customBlockCatalog: runtimeCatalog,
    projectIconCatalog: EMPTY_PROJECT_ICON_CATALOG,
  })
  const manifestCatalog = ref<ProjectCustomBlockManifestCatalog>(new Map([
    ['alice/first', {
      manifest: first.manifest,
      installationPath: first.installationPath,
      resourceRootPath: first.resourceRootPath,
      loadState: initialCatalog ? 'ready' : 'unloaded',
    }],
    ['alice/second', {
      manifest: second.manifest,
      installationPath: second.installationPath,
      resourceRootPath: second.resourceRootPath,
      loadState: initialCatalog ? 'ready' : 'unloaded',
    }],
  ]))
  const preview = useCustomBlockPreview({
    catalog,
    manifestCatalog,
    ensureLoaded: async packageId => catalog.value.get(packageId.toLowerCase()) ?? null,
    renderEnvironment,
    resourceRootPath: ref('D:/Project'),
    translate: key => key,
    hasMessage: () => false,
  })
  return { catalog, first, manifestCatalog, renderEnvironment, second, preview }
}

describe('useCustomBlockPreview', () => {
  it('selects Package IDs, materializes public defaults, and renders through the shared pipeline', async () => {
    const { preview } = createHarness()
    await nextTick()

    expect(preview.selectedPackageId.value).toBe('alice/first')
    expect(preview.entries.value[0]?.catalogEntry?.manifest.name).toBe('ALICE/FIRST')
    expect(preview.activeValues.value).toEqual({
      label: 'Ready',
      count: '0',
      enabled: 'false',
      color: '',
      content: '{{self:label}}',
    })
    expect(Object.keys(preview.propertyInputs.value[0]?.fields ?? {}))
      .toEqual(['label', 'count', 'enabled', 'color', 'content'])

    const host = preview.previewFace.value?.children[0]?.block
    expect(host).toMatchObject({ type: 'custom-block', id: 'custom-block-preview-host', packageId: 'alice/first' })
    expect(host?.type === 'custom-block' ? host.content : null)
      .toMatchObject({ type: 'text-block', content: 'Ready' })
    expect(preview.previewFitRect.value).toMatchObject({ left: 0, top: 0 })
  })

  it('keeps preview overrides per package and reset deletes the active override', async () => {
    const { first, preview } = createHarness()
    await nextTick()
    const originalDefinition = JSON.stringify(first.block)

    preview.updateProperty({ key: 'custom-block-preview', fieldKey: 'label', value: 'First edit' })
    preview.selectPackage('alice/second')
    await nextTick()
    preview.updateProperty({ key: 'custom-block-preview', fieldKey: 'label', value: 'Second edit' })
    preview.selectPackage('alice/first')
    await nextTick()

    expect(preview.activeValues.value.label).toBe('First edit')
    expect(preview.activeOverrides.value).toEqual({ label: 'First edit' })
    expect(JSON.stringify(first.block)).toBe(originalDefinition)
    preview.updateProperty({ key: 'custom-block-preview', fieldKey: 'label', value: undefined })
    expect(preview.activeOverrides.value).toEqual({})
    expect(preview.activeValues.value.label).toBe('Ready')
  })

  it('uses ordinary project-relative image paths from the package environment', async () => {
    const { first, preview, renderEnvironment } = createHarness()
    first.block = createBlock('image-block', { id: 'first-root', image: 'assets/a.png' })
    const environment = createEnvironment('alice/first')
    renderEnvironment.value = {
      ...renderEnvironment.value,
      customBlockCatalog: new Map([['alice/first', {
        manifest: first.manifest,
        block: first.block,
        environment,
        dependencies: new Map(),
      }]]),
    }
    await nextTick()

    const host = preview.previewFace.value?.children[0]?.block
    const image = host?.type === 'custom-block' ? host.content : null
    expect(image?.type === 'image-block' ? image.image : null).toBe('assets/a.png')
  })

  it('keeps manifest discovery visible while runtime loading is delayed', async () => {
    const { catalog, first, preview } = createHarness(false)
    await nextTick()
    expect(preview.selectedEntry.value?.descriptor.manifest.packageId).toBe('alice/first')
    expect(preview.selectedEntry.value?.catalogEntry).toBeNull()
    expect(preview.previewFace.value).toBeNull()

    catalog.value = new Map([['alice/first', first]])
    await nextTick()
    expect(preview.previewFace.value).not.toBeNull()
  })
})
