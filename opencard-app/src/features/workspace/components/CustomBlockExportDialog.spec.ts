import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlock, type CardDocument } from '../../../entities/card/model'
import OcTree from '../../../components/standard/OcTree.vue'
import enUS from '../../../locales/en-US'
import CustomBlockResourceTree from './CustomBlockResourceTree.vue'

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  createPreview: vi.fn(),
  ensureDependencies: vi.fn(async () => undefined),
}))

vi.mock('../services/exportProjectCustomBlock', () => ({
  prepareProjectCustomBlockExport: mocks.prepare,
}))
vi.mock('../services/projectCustomBlockPreview', () => ({
  createProjectCustomBlockPreview: mocks.createPreview,
  collectProjectCustomBlockSelectionIssues: (prepared: { resourceAnalysis: { candidates: Array<{ id: string, automatic: boolean, path: string }> } }, selected: Set<string>) => (
    prepared.resourceAnalysis.candidates
      .filter(candidate => candidate.automatic && !selected.has(candidate.id))
      .map(candidate => ({ code: 'resource-unavailable', path: candidate.path, message: 'Excluded' }))
  ),
}))
vi.mock('../services/fileSystemService', () => ({ fileSystemService: {} }))
vi.mock('../../settings/store/appSettingsStore', () => ({
  useAppSettingsStore: () => ({ settings: { value: { identity: { publisherKey: 'publisher-test' } } } }),
}))
vi.mock('../store/projectStore', () => ({
  useProjectStore: () => ({
    resolvedProject: { value: null }, resolvedDictionary: { value: null },
    projectFonts: { value: {} }, projectIconSeries: { value: [] },
    projectIconCatalog: { value: { series: [], entries: [], errors: [] } },
    projectCustomBlockManifestCatalog: { value: new Map() },
    projectCustomBlockRuntimeCatalog: { value: new Map() },
    projectResourceEnvironment: { value: {
      kind: 'project', namespace: 'project-test', rootPath: '/project',
      fontDocument: {}, fonts: {}, iconDocument: {}, iconCatalog: { series: [], entries: [], errors: [] }, issues: [],
    } },
    renderEnvironment: { value: {} },
    ensureProjectCustomBlocksLoaded: mocks.ensureDependencies,
  }),
}))

import CustomBlockExportDialog from './CustomBlockExportDialog.vue'

const document: CardDocument = {
  type: 'card-document', id: 'document', name: 'Document', version: '1', width: '100', height: '100', instances: [],
  faces: {
    front: {
      type: 'card-face', id: 'front', background: '#fff', children: [{
        block: createBlock('text-block', { id: 'root', content: 'Default' }),
        location: { id: 'location', type: 'simple-container-location', anchor: 'lt' },
      }],
    },
    back: { type: 'card-face', id: 'back', background: '#fff', children: [] },
  },
}

const resourceCandidate = {
  id: 'image:assets/background.png', kind: 'image' as const, path: 'assets/background.png', label: 'background.png',
  automatic: true, suggested: false, referenceCount: 1, references: ['root.image'],
}

function prepared() {
  const block = createBlock('text-block', { id: 'root', content: 'Default' })
  block.additionalFieldDefinition = { content: { fieldType: 'string', title: 'Content' } }
  return {
    manifest: {
      type: 'opencard-custom-block' as const, packageId: 'local/square', version: '0.1.0', name: 'Square',
      publicFieldKeys: ['name', 'notes'], resize: { widthLocked: false, heightLocked: false },
    },
    block,
    resourceAnalysis: {
      candidates: [resourceCandidate], defaultSelectedIds: new Set([resourceCandidate.id]), issues: [],
    },
    previewHostSize: { width: '100', height: '100' },
  }
}

function preview() {
  return {
    render: {
      document: { faces: { front: { id: 'front' }, back: { id: 'back' } } },
      resources: {},
      issues: [],
    },
    issues: [],
  }
}

const baseProps = {
  open: true,
  dialogTitle: 'Export custom block',
  document,
  rootBlockId: 'root',
  projectRootPath: '/project',
  fields: [
    { key: 'content', fieldType: 'string' as const, title: 'Content', referenceCount: 2, definitionOrder: 0, exposed: false },
  ],
  resize: { widthLocked: false, heightLocked: false },
  defaultName: 'Square',
  defaultKey: 'square',
}

function mountDialog() {
  return mount(CustomBlockExportDialog, {
    props: baseProps,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: {
        Teleport: true,
        CardViewport: { template: '<div class="card-viewport-stub" />', methods: { fitView() {}, zoomBy() {} } },
      },
    },
  })
}

async function finishInitialPreview(): Promise<void> {
  await flushPromises()
  await flushPromises()
}

describe('CustomBlockExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prepare.mockResolvedValue(prepared())
    mocks.createPreview.mockResolvedValue(preview())
  })

  it('shows package fields and initializes automatic resources', async () => {
    const wrapper = mountDialog()
    await finishInitialPreview()
    const tree = wrapper.getComponent(OcTree)
    expect(wrapper.text()).not.toContain('publisher-test')
    expect(tree.props('data').children.get('group:exposed')).toEqual(['resize:width', 'resize:height'])
    expect(tree.props('data').children.get('group:private')).toEqual(['field:content'])
    expect(wrapper.getComponent(CustomBlockResourceTree).props('selectedIds')).toEqual([resourceCandidate.id])
    expect(wrapper.getComponent({ name: 'PropertyEditor' }).props('inputs')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        record: expect.objectContaining({ width: '', height: '' }),
        fields: expect.objectContaining({ width: expect.any(Object), height: expect.any(Object) }),
      }),
    ]))
  })

  it('submits a fresh prepared snapshot without waiting for preview work', async () => {
    const wrapper = mountDialog()
    await finishInitialPreview()
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'resize:width', actionKey: 'move-private', source: 'inline' })
    tree.vm.$emit('intent', { type: 'action.invoke', key: 'field:content', actionKey: 'move-exposed', source: 'inline' })
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      name: 'Square', publisherKey: 'publisher-test', blockKey: 'square', version: '0.1.0',
      exposedFieldKeys: ['content'], resize: { widthLocked: true, heightLocked: false },
      prepared: { manifest: { packageId: 'publisher-test/square', publicFieldKeys: ['name', 'notes', 'content'] } },
    })
    expect(payload.selectedResourceIds).toEqual(new Set([resourceCandidate.id]))
  })

  it('requires confirmation for an explicitly excluded automatic resource', async () => {
    const wrapper = mountDialog()
    await finishInitialPreview()
    wrapper.getComponent(CustomBlockResourceTree).vm.$emit('update:selectedIds', new Set())
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Export with package issues?')
  })

  it('keeps PropertyEditor independent and sends only preview overrides to the memory renderer', async () => {
    const source = prepared()
    mocks.prepare.mockResolvedValue(source)
    const wrapper = mountDialog()
    await finishInitialPreview()
    wrapper.getComponent(OcTree).vm.$emit('intent', {
      type: 'action.invoke', key: 'field:content', actionKey: 'move-exposed', source: 'inline',
    })
    await flushPromises()
    const editor = wrapper.getComponent({ name: 'PropertyEditor' })
    expect(editor.props('inputs')).toEqual(expect.arrayContaining([
      expect.objectContaining({ record: expect.objectContaining({ content: 'Default' }) }),
    ]))
    editor.vm.$emit('update-property', {
      key: 'custom-block-export-preview', fieldKey: 'content', value: 'Preview only',
    })
    await flushPromises()
    expect(mocks.createPreview).toHaveBeenLastCalledWith(expect.objectContaining({
      prepared: expect.objectContaining({ block: source.block }),
      overrides: { content: 'Preview only' },
    }))
    expect(source.block).toMatchObject({ content: 'Default' })
  })
})
