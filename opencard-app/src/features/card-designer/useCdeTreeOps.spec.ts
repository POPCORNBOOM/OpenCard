import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import {
  createFlowContainerBlock,
  createCustomBlock,
  createSimpleContainerBlock,
  createTextBlock,
  type CardDocument,
  type CardFaceKey,
} from '../../entities/card/model'
import { buildParentLookup } from '../../entities/card/tree'
import { useCdeTreeOps } from './useCdeTreeOps'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
    id: 'document',
    name: 'Document',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: {
        type: 'card-face',
        id: 'front',
        background: '#FFFFFF',
        children: [{
          block: createTextBlock({ id: 'front-text', name: 'Front' }),
          location: { type: 'simple-container-location', id: 'front-location', anchor: 'lt' },
        }],
      },
      back: {
        type: 'card-face',
        id: 'back',
        background: '#000000',
        children: [{
          block: createTextBlock({ id: 'back-text', name: 'Back' }),
          location: { type: 'simple-container-location', id: 'back-location', anchor: 'lt' },
        }],
      },
    },
    instances: [],
  }
}

describe('useCdeTreeOps active face boundary', () => {
  it('keeps selection but removes editing affordances in read-only projections', () => {
    const document = createDocument()
    const selectedBlockKeys = ref<string[]>([])
    const readOnly = ref(true)
    const state = useCdeTreeOps({
      activeFace: ref(document.faces.front),
      documentRevision: ref(0),
      parentLookup: ref(buildParentLookup(document)),
      selectedBlockKeys,
      getDefaultBlockName: type => type,
      refreshDocumentState: vi.fn(),
      markDocumentChanged: vi.fn(),
      readOnly,
      comparisonRole: ref('current'),
      comparisonChangedBlockIds: ref(['front-text']),
    })

    expect(state.blockTreeData.value.items.get('front-text')).toMatchObject({
      renamable: false,
      draggable: false,
      actions: [],
      contextActions: [],
      icon: 'entity.block-text',
      changeMarkers: [{ icon: 'action.add', tone: 'success' }],
    })
    state.handleTreeIntent({
      type: 'selection.change', triggerKey: 'front-text', selectedKeys: ['front-text'], mode: 'replace', input: 'left',
    })
    expect(selectedBlockKeys.value).toEqual(['front-text'])
  })

  it('maps namespaced custom block descendants back to their host', () => {
    const document = createDocument()
    const host = createCustomBlock({ id: 'custom-host', source: 'block:item', interfaceHash: 'hash' })
    document.faces.front.children = [{
      block: host,
      location: { type: 'simple-container-location', id: 'custom-location', anchor: 'lt' },
    }]
    const selectedBlockKeys = ref<string[]>([])
    const state = useCdeTreeOps({
      activeFace: computed(() => document.faces.front),
      documentRevision: ref(0),
      parentLookup: ref(buildParentLookup(document)),
      selectedBlockKeys,
      getDefaultBlockName: type => type,
      refreshDocumentState: vi.fn(),
      markDocumentChanged: vi.fn(),
    })
    state.handleViewportBlockClick('custom-host::block:internal-label')
    expect(selectedBlockKeys.value).toEqual(['custom-host'])
  })

  it('projects and mutates only the active face', async () => {
    const document = createDocument()
    const activeFaceKey = ref<CardFaceKey>('front')
    const activeFace = computed(() => document.faces[activeFaceKey.value])
    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref<string[]>(['front-text'])
    const markDocumentChanged = vi.fn()
    const state = useCdeTreeOps({
      activeFace,
      documentRevision,
      parentLookup,
      selectedBlockKeys,
      getDefaultBlockName: type => `Localized ${type}`,
      refreshDocumentState: () => {
        documentRevision.value += 1
        parentLookup.value = buildParentLookup(document)
      },
      markDocumentChanged,
    })

    expect(state.blockTreeData.value.rootKeys).toEqual(['front-text'])
    expect(state.blockTreeData.value.items.get('front-text')).toMatchObject({
      actions: ['hide-block', 'block-more'],
      iconTone: 'block-text',
    })

    state.handleTreeIntent({ type: 'action.invoke', key: 'front-text', actionKey: 'hide-block', source: 'inline' })
    expect(document.faces.front.children[0]!.block.visible).toBe('false')
    expect(state.blockTreeData.value.items.get('front-text')).toMatchObject({
      actions: ['show-block', 'block-more'],
      iconTone: 'muted',
    })

    state.handleTreeIntent({ type: 'action.invoke', key: 'front-text', actionKey: 'show-block', source: 'inline' })
    expect(document.faces.front.children[0]!.block.visible).toBe('true')
    expect(markDocumentChanged).toHaveBeenCalledWith('action')

    activeFaceKey.value = 'back'
    await nextTick()
    expect(state.blockTreeData.value.rootKeys).toEqual(['back-text'])
    expect(selectedBlockKeys.value).toEqual([])

    state.handleRootAction('add-text-block')
    expect(document.faces.back.children).toHaveLength(2)
    expect(document.faces.front.children).toHaveLength(1)
    expect(document.faces.back.children[1]?.block.name).toBe('Localized text-block')
    expect(markDocumentChanged).toHaveBeenCalledWith('action')

    state.handleRootAction('add-markdown-text-block')
    expect(document.faces.back.children).toHaveLength(3)
    expect(document.faces.back.children[2]?.block.type).toBe('markdown-text-block')
    expect(document.faces.back.children[2]?.block.name).toBe('Localized markdown-text-block')
  })

  it('projects packaged containers as atomic tree nodes and preserves nested package boundaries', () => {
    const document = createDocument()
    const inner = createFlowContainerBlock({
      id: 'inner',
      packaged: 'true',
      children: [{
        block: createTextBlock({ id: 'inner-text' }),
        location: { id: 'inner-text-location', type: 'flow-container-location', index: '0' },
      }],
    })
    const outer = createSimpleContainerBlock({
      id: 'outer',
      packaged: 'true',
      children: [{
        block: inner,
        location: { id: 'inner-location', type: 'simple-container-location', anchor: 'lt' },
      }],
    })
    const sibling = createTextBlock({ id: 'sibling' })
    document.faces.front.children = [
      { block: outer, location: { id: 'outer-location', type: 'simple-container-location', anchor: 'lt' } },
      { block: sibling, location: { id: 'sibling-location', type: 'simple-container-location', anchor: 'lt' } },
    ]

    const activeFace = ref(document.faces.front)
    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref<string[]>([])
    const state = useCdeTreeOps({
      activeFace,
      documentRevision,
      parentLookup,
      selectedBlockKeys,
      getDefaultBlockName: type => type,
      refreshDocumentState: () => {
        documentRevision.value += 1
        parentLookup.value = buildParentLookup(document)
      },
      markDocumentChanged: vi.fn(),
    })

    expect([...state.blockTreeData.value.items.keys()]).toEqual(['outer', 'sibling'])
    expect(state.blockTreeData.value.children.has('outer')).toBe(false)
    expect(state.blockTreeData.value.items.get('outer')).toMatchObject({
      icon: 'entity.block-package',
      actions: ['hide-block', 'packaged-container-more'],
      contextActions: ['hide-block', 'rename', 'export-custom-block', 'unpackage', 'duplicate', 'delete'],
    })

    state.handleViewportBlockClick('inner-text')
    expect(selectedBlockKeys.value).toEqual(['outer'])

    state.handleTreeIntent({ type: 'action.invoke', key: 'outer', actionKey: 'unpackage', source: 'context' })
    expect(outer.packaged).toBeUndefined()
    expect(state.blockTreeData.value.children.get('outer')).toEqual(['inner'])
    expect(state.blockTreeData.value.items.get('inner')).toMatchObject({ icon: 'entity.block-package' })
    expect(state.blockTreeData.value.items.has('inner-text')).toBe(false)

    state.handleViewportBlockClick('inner-text')
    expect(selectedBlockKeys.value).toEqual(['inner'])

    state.handleTreeIntent({ type: 'action.invoke', key: 'outer', actionKey: 'package', source: 'context' })
    expect(outer.packaged).toBe('true')
    expect(inner.packaged).toBe('true')
  })

  it('rejects internal mutations while allowing packaged containers to move and duplicate as a whole', () => {
    const document = createDocument()
    const packaged = createSimpleContainerBlock({ id: 'package', packaged: 'true' })
    const sibling = createTextBlock({ id: 'sibling' })
    document.faces.front.children = [
      { block: packaged, location: { id: 'package-location', type: 'simple-container-location', anchor: 'lt' } },
      { block: sibling, location: { id: 'sibling-location', type: 'simple-container-location', anchor: 'lt' } },
    ]

    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const state = useCdeTreeOps({
      activeFace: ref(document.faces.front),
      documentRevision,
      parentLookup,
      selectedBlockKeys: ref<string[]>([]),
      getDefaultBlockName: type => type,
      refreshDocumentState: () => {
        documentRevision.value += 1
        parentLookup.value = buildParentLookup(document)
      },
      markDocumentChanged: vi.fn(),
    })

    state.handleTreeIntent({ type: 'action.invoke', key: 'package', actionKey: 'add-text-block', source: 'context' })
    expect(packaged.children).toEqual([])

    state.handleTreeIntent({ type: 'move.request', key: 'sibling', targetKey: 'package', position: 'inside' })
    expect(parentLookup.value.get('sibling')).toMatchObject({ type: 'card-face', id: 'front' })

    state.handleTreeIntent({ type: 'move.request', key: 'sibling', targetKey: 'package', position: 'before' })
    expect(document.faces.front.children.map(child => child.block.id)).toEqual(['sibling', 'package'])

    state.handleTreeIntent({ type: 'action.invoke', key: 'package', actionKey: 'duplicate', source: 'context' })
    const duplicate = document.faces.front.children[2]?.block
    expect(duplicate).toMatchObject({ type: 'simple-container-block', packaged: 'true' })
  })

  it('inserts catalog custom blocks at the root or inside unpackaged containers only', () => {
    const document = createDocument()
    const openContainer = createSimpleContainerBlock({ id: 'open-container' })
    const packagedContainer = createSimpleContainerBlock({ id: 'packaged-container', packaged: 'true' })
    document.faces.front.children = [
      { block: openContainer, location: { id: 'open-location', type: 'simple-container-location', anchor: 'lt' } },
      { block: packagedContainer, location: { id: 'packaged-location', type: 'simple-container-location', anchor: 'lt' } },
    ]
    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const state = useCdeTreeOps({
      activeFace: ref(document.faces.front),
      documentRevision,
      parentLookup,
      selectedBlockKeys: ref([]),
      getDefaultBlockName: type => type,
      createCustomBlock: key => createCustomBlock({ source: `block:${key}`, interfaceHash: 'hash' }),
      refreshDocumentState: () => {
        documentRevision.value += 1
        parentLookup.value = buildParentLookup(document)
      },
      markDocumentChanged: vi.fn(),
    })

    state.handleRootAction('add-custom-block:square')
    expect(document.faces.front.children[2]?.block).toMatchObject({
      type: 'custom-block',
      source: 'block:square',
    })

    state.handleTreeIntent({
      type: 'action.invoke',
      key: 'open-container',
      actionKey: 'add-custom-block:square',
      source: 'context',
    })
    expect(openContainer.children[0]?.block.type).toBe('custom-block')

    state.handleTreeIntent({
      type: 'action.invoke',
      key: 'packaged-container',
      actionKey: 'add-custom-block:square',
      source: 'context',
    })
    expect(packagedContainer.children).toHaveLength(0)
  })
})
