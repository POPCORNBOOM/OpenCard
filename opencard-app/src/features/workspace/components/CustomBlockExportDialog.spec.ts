import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createBlock, type CardDocument } from '../../../entities/card/model'
import OcTree from '../../../components/standard/OcTree.vue'
import enUS from '../../../locales/en-US'
import CustomBlockResourceTree from './CustomBlockResourceTree.vue'

const mocks = vi.hoisted(() => ({
  prepare: vi.fn(),
  buildCandidate: vi.fn(),
  createPreview: vi.fn(),
}))

vi.mock('../services/exportProjectCustomBlock', () => ({
  prepareProjectCustomBlockExport: mocks.prepare,
  buildProjectCustomBlockCandidate: mocks.buildCandidate,
}))
vi.mock('../services/projectCustomBlockCandidatePreview', () => ({
  createProjectCustomBlockCandidatePreview: mocks.createPreview,
}))
vi.mock('../services/fileSystemService', () => ({ fileSystemService: {} }))
vi.mock('../store/projectStore', () => ({
  useProjectStore: () => ({
    resolvedProject: { value: null }, resolvedDictionary: { value: null },
    projectFonts: { value: {} }, projectIconSeries: { value: [] },
    projectCustomBlockManifestCatalog: { value: new Map() },
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
  }
}

function candidate() {
  return {
    ...prepared(),
    resources: { files: new Map(), issues: [], selectedCandidates: [resourceCandidate] },
  }
}

function preview(release = vi.fn(async () => undefined), diagnostics = false) {
  return {
    render: {
      document: { faces: { front: { id: 'front' }, back: { id: 'back' } } },
      resources: {},
      issues: diagnostics ? [{ type: 'preview.render-warning' }] : [],
    },
    packageIssues: diagnostics ? [{ code: 'resource-unavailable', path: 'assets/missing.png', message: 'Missing' }] : [],
    release,
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

function mountDialog(props = {}) {
  return mount(CustomBlockExportDialog, {
    props: { ...baseProps, ...props },
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en-US', messages: { 'en-US': enUS } })],
      stubs: {
        Teleport: true,
        CardViewport: { template: '<div class="card-viewport-stub" />', methods: { fitView() {}, zoomBy() {} } },
        PropertyEditor: {
          name: 'PropertyEditor',
          props: ['inputs'],
          emits: ['update-property'],
          template: '<div class="property-editor-stub" />',
        },
      },
    },
  })
}

async function finishInitialPreview(): Promise<void> {
  await vi.advanceTimersByTimeAsync(181)
  await flushPromises()
  await vi.advanceTimersByTimeAsync(121)
  await flushPromises()
}

describe('CustomBlockExportDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.prepare.mockResolvedValue(prepared())
    mocks.buildCandidate.mockResolvedValue(candidate())
    mocks.createPreview.mockResolvedValue(preview())
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows package identity and keeps dimensions public while additional fields start private', async () => {
    const wrapper = mountDialog()
    await finishInitialPreview()
    const tree = wrapper.getComponent(OcTree)
    expect(wrapper.text()).toContain('local/square')
    expect(tree.props('data').children.get('group:exposed')).toEqual(['resize:width', 'resize:height'])
    expect(tree.props('data').children.get('group:private')).toEqual(['field:content'])
    expect(wrapper.getComponent(CustomBlockResourceTree).props('selectedIds')).toEqual([resourceCandidate.id])
  })

  it('emits current package metadata, public fields, resize policy, and final resource selection', async () => {
    const wrapper = mountDialog()
    await finishInitialPreview()
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'resize:width', actionKey: 'move-private', source: 'inline',
    })
    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'field:content', actionKey: 'move-exposed', source: 'inline',
    })
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    const payload = wrapper.emitted('submit')?.[0]?.[0] as Record<string, unknown>
    expect(payload).toMatchObject({
      name: 'Square', publisherKey: 'local', blockKey: 'square', version: '0.1.0',
      exposedFieldKeys: ['content'], resize: { widthLocked: true, heightLocked: false },
    })
    expect(payload.selectedResourceIds).toEqual(new Set([resourceCandidate.id]))
  })

  it('requires explicit confirmation when the real candidate preview reports diagnostics', async () => {
    mocks.createPreview.mockResolvedValue(preview(vi.fn(), true))
    const wrapper = mountDialog()
    await finishInitialPreview()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Export with package issues?')
    const exportAnyway = wrapper.findAll('button').find(button => button.text().includes('Export anyway'))
    if (!exportAnyway) throw new Error('Missing diagnostic confirmation')
    await exportAnyway.trigger('click')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('keeps public-field edits on the preview instance and removes overrides on privatization', async () => {
    const sourceCandidate = candidate()
    mocks.buildCandidate.mockResolvedValue(sourceCandidate)
    const wrapper = mountDialog()
    await finishInitialPreview()
    const tree = wrapper.getComponent(OcTree)
    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'field:content', actionKey: 'move-exposed', source: 'inline',
    })
    await vi.advanceTimersByTimeAsync(301)
    await flushPromises()
    const editor = wrapper.getComponent({ name: 'PropertyEditor' })
    editor.vm.$emit('update-property', {
      key: 'custom-block-export-preview', fieldKey: 'content', value: 'Preview only',
    })
    await vi.advanceTimersByTimeAsync(121)
    await flushPromises()
    expect(mocks.createPreview).toHaveBeenLastCalledWith(expect.objectContaining({
      candidate: sourceCandidate, overrides: { content: 'Preview only' },
    }))
    expect(sourceCandidate.block).toMatchObject({ content: 'Default' })

    tree.vm.$emit('intent', {
      type: 'action.invoke', key: 'field:content', actionKey: 'move-private', source: 'inline',
    })
    await vi.advanceTimersByTimeAsync(301)
    await flushPromises()
    expect(mocks.createPreview).toHaveBeenLastCalledWith(expect.objectContaining({ overrides: {} }))
  })

  it('releases the temporary candidate when the dialog closes', async () => {
    const release = vi.fn(async () => undefined)
    mocks.createPreview.mockResolvedValue(preview(release))
    const wrapper = mountDialog()
    await finishInitialPreview()
    await wrapper.setProps({ open: false })
    await flushPromises()
    expect(release).toHaveBeenCalledOnce()
  })

  it('releases stale async preview results instead of replacing newer settings', async () => {
    const baselineRelease = vi.fn(async () => undefined)
    mocks.createPreview.mockResolvedValueOnce(preview(baselineRelease))
    const wrapper = mountDialog()
    await finishInitialPreview()

    let resolveStale!: (value: ReturnType<typeof preview>) => void
    const staleRelease = vi.fn(async () => undefined)
    const freshRelease = vi.fn(async () => undefined)
    mocks.createPreview
      .mockImplementationOnce(() => new Promise(resolve => { resolveStale = resolve }))
      .mockResolvedValueOnce(preview(freshRelease))

    wrapper.getComponent(CustomBlockResourceTree).vm.$emit('update:selectedIds', new Set())
    await vi.advanceTimersByTimeAsync(121)
    await flushPromises()
    wrapper.getComponent(CustomBlockResourceTree).vm.$emit('update:selectedIds', new Set([resourceCandidate.id]))
    await vi.advanceTimersByTimeAsync(121)
    await flushPromises()
    resolveStale(preview(staleRelease))
    await flushPromises()

    expect(staleRelease).toHaveBeenCalledOnce()
    expect(baselineRelease).toHaveBeenCalledOnce()
    expect(freshRelease).not.toHaveBeenCalled()
  })
})
