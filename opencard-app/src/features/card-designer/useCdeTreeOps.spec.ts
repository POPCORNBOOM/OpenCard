import { computed, nextTick, ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { createTextBlock, type CardDocument, type CardFaceKey } from '../../entities/card/model'
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
})
