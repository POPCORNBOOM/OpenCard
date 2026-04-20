import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { buildParentLookup, type CardDocument } from '../../entities/card/model'
import { useCdeTreeOps } from '../useCdeTreeOps'

function createDocumentForTreeReorder(): CardDocument {
  return {
    type: 'card-document',
    name: 'test',
    id: 'doc-1',
    version: 1,
    width: 1000,
    height: 600,
    children: [
      {
        block: {
          type: 'text-block',
          id: 'block-a',
          name: 'A',
          content: 'A',
          mode: 'plain',
        },
        location: {
          type: 'simple-container-location',
          anchor: 'lt',
          x: 0,
          y: 0,
        },
      },
      {
        block: {
          type: 'text-block',
          id: 'block-b',
          name: 'B',
          content: 'B',
          mode: 'plain',
        },
        location: {
          type: 'simple-container-location',
          anchor: 'lt',
          x: 0,
          y: 0,
        },
      },
    ],
    instances: [],
  }
}

describe('useCdeTreeOps', () => {
  it('reorders blocks by drag/drop and marks document changed', () => {
    const document = createDocumentForTreeReorder()
    const cardDoc = ref<CardDocument | null>(document)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref<string[]>([])
    const markDocumentChanged = vi.fn()

    const treeOps = useCdeTreeOps({
      cardDoc,
      parentLookup,
      selectedBlockKeys,
      markDocumentChanged,
    })

    const dragged = treeOps.blockTree.value[0]
    const target = treeOps.blockTree.value[1]
    expect(treeOps.canDropTreeNode({ dragged, target, position: 'after' })).toBe(true)

    treeOps.handleTreeDrop({ dragged, target, position: 'after' })

    expect(cardDoc.value?.children.map((child) => child.block.id)).toEqual(['block-b', 'block-a'])
    expect(selectedBlockKeys.value).toEqual([dragged.key])
    expect(markDocumentChanged).toHaveBeenCalledTimes(1)
  })

  it('duplicates a selected block and inserts it after source block', () => {
    const document = createDocumentForTreeReorder()
    const cardDoc = ref<CardDocument | null>(document)
    const parentLookup = ref(buildParentLookup(document))
    const selectedBlockKeys = ref<string[]>([])
    const markDocumentChanged = vi.fn()

    const randomUuidSpy = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000001')

    const treeOps = useCdeTreeOps({
      cardDoc,
      parentLookup,
      selectedBlockKeys,
      markDocumentChanged,
    })

    const sourceNode = treeOps.blockTree.value[0]
    treeOps.handleTreeAction({
      actionKey: 'duplicate',
      caller: 'node',
      node: sourceNode,
    })

    expect(cardDoc.value?.children.map((child) => child.block.id)).toEqual([
      'block-a',
      'text-block-00000000-0000-4000-8000-000000000001',
      'block-b',
    ])
    expect(cardDoc.value?.children[1]?.block.name).toBe('A 副本')
    expect(selectedBlockKeys.value).toEqual(['text-block-00000000-0000-4000-8000-000000000001'])
    expect(markDocumentChanged).toHaveBeenCalledTimes(1)

    randomUuidSpy.mockRestore()
  })
})
