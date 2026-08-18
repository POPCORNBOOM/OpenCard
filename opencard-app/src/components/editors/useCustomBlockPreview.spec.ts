import { nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import { createBlock } from '../../entities/card/model'
import type { CardRenderEnvironment } from '../../features/card-rendering/renderPipeline'
import type {
  ProjectCustomBlockCatalog,
  ProjectCustomBlockCatalogEntry,
  ProjectCustomBlockRegistryDocument,
} from '../../features/workspace/model/projectCustomBlocks'
import { EMPTY_PROJECT_ICON_CATALOG } from '../../features/workspace/services/projectIconCatalog'
import { useCustomBlockPreview } from './useCustomBlockPreview'

function createEntry(key: string, path: string): ProjectCustomBlockCatalogEntry {
  const root = createBlock('text-block', { id: `${key}-root`, content: '{{self:label}}' })
  root.additionalFieldDefinition = {
    label: { fieldType: 'string', title: 'Label' },
    count: { fieldType: 'number', title: 'Count' },
    enabled: { fieldType: 'boolean', title: 'Enabled' },
    color: { fieldType: 'color', title: 'Color' },
  }
  return {
    archivePath: path,
    files: new Map(),
    manifest: {
      type: 'opencard-custom-block',

      customBlockKey: key,
      name: key.toUpperCase(),
      publicFieldKeys: ['label', 'count', 'enabled', 'color', 'content'],
      resize: { widthLocked: false, heightLocked: false },
    },
    block: Object.assign(root, { label: 'Ready' }),
  }
}

function createHarness(initialCatalog = true) {
  const first = createEntry('first', 'blocks/first.ocblock')
  const second = createEntry('second', 'blocks/second.ocblock')
  const document = ref<ProjectCustomBlockRegistryDocument | null>({
    blocks: [first.archivePath, second.archivePath],
  })
  const catalog = ref<ProjectCustomBlockCatalog>(initialCatalog
    ? new Map([['first', first], ['second', second]])
    : new Map())
  const renderEnvironment = ref<CardRenderEnvironment>({
    project: null,
    dictionary: null,
    customBlockCatalog: new Map([['first', first], ['second', second]]),
    projectIconCatalog: EMPTY_PROJECT_ICON_CATALOG,
  })
  const manifestCatalog = ref(new Map([
    ['first', { manifest: first.manifest, archivePath: first.archivePath, loadState: 'ready' as const }],
    ['second', { manifest: second.manifest, archivePath: second.archivePath, loadState: 'ready' as const }],
  ]))
  const preview = useCustomBlockPreview({
    document,
    catalog,
    manifestCatalog,
    ensureLoaded: async key => catalog.value.get(key.toLowerCase()) ?? null,
    renderEnvironment,
    resourceRootPath: ref('D:/Project'),
    translate: key => key,
    hasMessage: () => false,
  })
  return { catalog, document, first, renderEnvironment, second, preview }
}

describe('useCustomBlockPreview', () => {
  it('matches registry paths, materializes public defaults, and renders through the shared pipeline', async () => {
    const { preview } = createHarness()
    await nextTick()

    expect(preview.selectedPath.value).toBe('blocks/first.ocblock')
    expect(preview.entries.value[0]?.catalogEntry?.manifest.name).toBe('FIRST')
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
    expect(host).toMatchObject({ type: 'custom-block', id: 'custom-block-preview-host' })
    expect(host?.type === 'custom-block' ? host.content : null)
      .toMatchObject({ type: 'text-block', content: 'Ready' })
    expect(preview.previewFitRect.value).toMatchObject({ left: 0, top: 0 })
    expect(preview.previewFitRect.value?.width).toBeGreaterThan(0)
    expect(preview.previewFitRect.value?.height).toBeGreaterThan(0)
  })

  it('keeps preview values per block without changing the registry document', async () => {
    const { document, preview } = createHarness()
    await nextTick()
    const originalDocument = JSON.stringify(document.value)

    preview.updateProperty({ key: 'custom-block-preview', fieldKey: 'label', value: 'First edit' })
    preview.selectPath('blocks/second.ocblock')
    await nextTick()
    preview.updateProperty({ key: 'custom-block-preview', fieldKey: 'label', value: 'Second edit' })
    preview.selectPath('blocks/first.ocblock')
    await nextTick()

    expect(preview.activeValues.value.label).toBe('First edit')
    expect(JSON.stringify(document.value)).toBe(originalDocument)
    preview.resetActiveValues()
    expect(preview.activeValues.value.label).toBe('Ready')
  })

  it('uses the shared renderer resource context for packaged images', async () => {
    const { first, preview, renderEnvironment } = createHarness()
    first.block = createBlock('image-block', {
      id: 'first-root',
      image: 'resource:image:a',
    })
    first.manifest.resources = { images: [{ key: 'a', source: 'resources/images/a.png' }] }
    renderEnvironment.value = {
      ...renderEnvironment.value,
      customBlockCatalog: new Map([['first', {
        ...first,
        resourceUrls: new Map([['resources/images/a.png', 'blob:controlled-preview']]),
      }]]),
    }
    await nextTick()

    const host = preview.previewFace.value?.children[0]?.block
    const image = host?.type === 'custom-block' ? host.content : null
    expect(image?.type === 'image-block' ? image.image : null)
      .toBe('resource:image:a')
  })

  it('selects the neighboring path after removal and recovers from a delayed catalog', async () => {
    const { catalog, document, first, second, preview } = createHarness(false)
    await nextTick()
    expect(preview.selectedEntry.value?.catalogEntry).toBeNull()
    expect(preview.previewFace.value).toBeNull()

    catalog.value = new Map([['first', first], ['second', second]])
    await nextTick()
    expect(preview.previewFace.value).not.toBeNull()

    document.value = { blocks: [second.archivePath] }
    await nextTick()
    expect(preview.selectedPath.value).toBe(second.archivePath)
  })
})
