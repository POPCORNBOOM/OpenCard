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
  it('maps namespaced custom block descendants back to their host', () => {
    const document = createDocument()
    const host = createCustomBlock({ id: 'custom-host', customBlockKey: 'item' })
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
    expect(markDocumentChanged).toHaveBeenCalledWith('action', 'structure-tree', true)

    activeFaceKey.value = 'back'
    await nextTick()
    expect(state.blockTreeData.value.rootKeys).toEqual(['back-text'])
    expect(selectedBlockKeys.value).toEqual([])

    state.handleRootAction('add-text-block')
    expect(document.faces.back.children).toHaveLength(2)
    expect(document.faces.front.children).toHaveLength(1)
    expect(document.faces.back.children[1]?.block.name).toBe('Localized text-block')
    expect(markDocumentChanged).toHaveBeenCalledWith('action', 'structure-tree', true)

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
      createCustomBlock: key => createCustomBlock({ customBlockKey: key }),
      refreshDocumentState: () => {
        documentRevision.value += 1
        parentLookup.value = buildParentLookup(document)
      },
      markDocumentChanged: vi.fn(),
    })

    state.handleRootAction('add-custom-block:square')
    expect(document.faces.front.children[2]?.block).toMatchObject({
      type: 'custom-block',
      customBlockKey: 'square',
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

  it('moves selected roots from different parents in visual order as one action', () => {
    const document = createDocument()
    const left = createSimpleContainerBlock({
      id: 'left',
      children: [{
        block: createTextBlock({ id: 'left-child' }),
        location: { id: 'left-child-location', type: 'simple-container-location', anchor: 'lt' },
      }],
    })
    const right = createFlowContainerBlock({
      id: 'right',
      children: [{
        block: createTextBlock({ id: 'right-child' }),
        location: { id: 'right-child-location', type: 'flow-container-location', index: '0' },
      }],
    })
    const target = createFlowContainerBlock({ id: 'target' })
    document.faces.front.children = [left, right, target].map(block => ({
      block,
      location: { id: `${block.id}-location`, type: 'simple-container-location' as const, anchor: 'lt' as const },
    }))
    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref(['right-child', 'left-child'])
    const refreshDocumentState = vi.fn(() => {
      documentRevision.value += 1
      parentLookup.value = buildParentLookup(document)
    })
    const markDocumentChanged = vi.fn()
    const state = useCdeTreeOps({
      activeFace: ref(document.faces.front),
      documentRevision,
      parentLookup,
      selectedBlockKeys,
      getDefaultBlockName: type => type,
      refreshDocumentState,
      markDocumentChanged,
    })

    state.handleTreeIntent({ type: 'move.request', key: 'left-child', targetKey: 'target', position: 'inside' })

    expect(left.children).toEqual([])
    expect(right.children).toEqual([])
    expect(target.children.map(child => child.block.id)).toEqual(['left-child', 'right-child'])
    expect(target.children.map(child => child.location)).toMatchObject([
      { type: 'flow-container-location', index: '0' },
      { type: 'flow-container-location', index: '1' },
    ])
    expect(selectedBlockKeys.value).toEqual(['right-child', 'left-child'])
    expect(refreshDocumentState).toHaveBeenCalledTimes(1)
    expect(markDocumentChanged).toHaveBeenCalledTimes(1)
  })

  it('adjusts same-parent insertion and applies selected-node context delete to the batch', () => {
    const document = createDocument()
    document.faces.front.children = ['a', 'b', 'c', 'd'].map(id => ({
      block: createTextBlock({ id }),
      location: { id: `${id}-location`, type: 'simple-container-location' as const, anchor: 'lt' as const },
    }))
    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref(['b', 'c'])
    const refreshDocumentState = vi.fn(() => {
      documentRevision.value += 1
      parentLookup.value = buildParentLookup(document)
    })
    const markDocumentChanged = vi.fn()
    const state = useCdeTreeOps({
      activeFace: ref(document.faces.front),
      documentRevision,
      parentLookup,
      selectedBlockKeys,
      getDefaultBlockName: type => type,
      refreshDocumentState,
      markDocumentChanged,
    })

    state.handleTreeIntent({ type: 'move.request', key: 'c', targetKey: 'a', position: 'before' })
    expect(document.faces.front.children.map(entry => entry.block.id)).toEqual(['b', 'c', 'a', 'd'])
    expect(selectedBlockKeys.value).toEqual(['b', 'c'])

    state.handleTreeIntent({ type: 'action.invoke', key: 'b', actionKey: 'delete', source: 'context' })
    expect(document.faces.front.children.map(entry => entry.block.id)).toEqual(['a', 'd'])
    expect(selectedBlockKeys.value).toEqual([])
    expect(refreshDocumentState).toHaveBeenCalledTimes(2)
    expect(markDocumentChanged).toHaveBeenCalledTimes(2)
  })

  it('deduplicates selected descendants for delete and rejects drops into the selected subtree', () => {
    const document = createDocument()
    const child = createTextBlock({ id: 'child' })
    const container = createSimpleContainerBlock({
      id: 'container',
      children: [{
        block: child,
        location: { id: 'child-location', type: 'simple-container-location', anchor: 'lt' },
      }],
    })
    const sibling = createTextBlock({ id: 'sibling' })
    document.faces.front.children = [container, sibling].map(block => ({
      block,
      location: { id: `${block.id}-location`, type: 'simple-container-location' as const, anchor: 'lt' as const },
    }))
    const documentRevision = ref(0)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref(['container', 'child'])
    const refreshDocumentState = vi.fn(() => {
      documentRevision.value += 1
      parentLookup.value = buildParentLookup(document)
    })
    const markDocumentChanged = vi.fn()
    const state = useCdeTreeOps({
      activeFace: ref(document.faces.front),
      documentRevision,
      parentLookup,
      selectedBlockKeys,
      getDefaultBlockName: type => type,
      refreshDocumentState,
      markDocumentChanged,
    })

    state.handleTreeIntent({ type: 'move.request', key: 'child', targetKey: 'child', position: 'inside' })
    expect(document.faces.front.children.map(entry => entry.block.id)).toEqual(['container', 'sibling'])
    expect(refreshDocumentState).not.toHaveBeenCalled()

    state.handleRootAction('delete-selected')
    expect(document.faces.front.children.map(entry => entry.block.id)).toEqual(['sibling'])
    expect(selectedBlockKeys.value).toEqual([])
    expect(refreshDocumentState).toHaveBeenCalledTimes(1)
    expect(markDocumentChanged).toHaveBeenCalledTimes(1)
  })
})
