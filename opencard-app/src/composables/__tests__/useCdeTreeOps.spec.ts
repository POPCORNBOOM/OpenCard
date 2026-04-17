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
})
