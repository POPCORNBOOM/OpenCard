import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { CardDocument } from '../../entities/card/model'
import { useCdeInstanceOps } from './useCdeInstanceOps'

describe('useCdeInstanceOps tree actions', () => {
  it('projects instance operations behind a single submenu action', () => {
    const document: CardDocument = {
      type: 'card-document',

      id: 'document',
      version: '1.0.0',
      width: '540',
      height: '850',
      faces: {
        front: { type: 'card-face', id: 'front', background: '#FFFFFF', children: [] },
        back: { type: 'card-face', id: 'back', background: '#FFFFFF', children: [] },
      },
      instances: [{
        type: 'card-instance',
        id: 'instance-1',
        name: 'Instance 1',
        amount: '1',
        data: {},
      }],
    }
    const state = useCdeInstanceOps({
      cardDoc: ref(document),
      documentRevision: ref(0),
      blueprintCardId: '__blueprint__',
      selectedCardId: ref('__blueprint__'),
      selectedCardKeys: ref(['__blueprint__']),
      refreshDocumentState: vi.fn(),
      markDocumentChanged: vi.fn(),
    })

    expect(state.instanceTreeData.value.items.get('__blueprint__')?.actions).toBeUndefined()
    expect(state.instanceTreeData.value.items.get('instance-1')?.actions).toEqual(['instance-more'])
  })

  it('keeps explicit data-table export selection aligned with Instance lifecycle', () => {
    const document: CardDocument = {
      type: 'card-document',

      id: 'document',
      version: '1.0.0',
      width: '540',
      height: '850',
      faces: {
        front: { type: 'card-face', id: 'front', background: '#FFFFFF', children: [] },
        back: { type: 'card-face', id: 'back', background: '#FFFFFF', children: [] },
      },
      instances: [{ type: 'card-instance', id: 'one', name: 'One', amount: '1', data: {} }],
      dataTable: { blocks: {}, exportInstanceIds: [] },
    }
    const state = useCdeInstanceOps({
      cardDoc: ref(document),
      documentRevision: ref(0),
      blueprintCardId: '__blueprint__',
      selectedCardId: ref('__blueprint__'),
      selectedCardKeys: ref(['__blueprint__']),
      refreshDocumentState: vi.fn(),
      markDocumentChanged: vi.fn(),
    })

    state.createInstance()
    const createdId = document.instances[document.instances.length - 1]!.id
    expect(document.dataTable?.exportInstanceIds).toContain(createdId)
    state.duplicateInstance('one')
    const duplicatedId = document.instances[1]!.id
    expect(document.dataTable?.exportInstanceIds).toContain(duplicatedId)
    state.deleteInstance(duplicatedId)
    expect(document.dataTable?.exportInstanceIds).not.toContain(duplicatedId)
  })
})
