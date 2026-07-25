import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { CardDocument } from '../../entities/card/model'
import { useCdeInstanceOps } from './useCdeInstanceOps'

describe('useCdeInstanceOps tree actions', () => {
  it('projects instance operations behind a single submenu action', () => {
    const document: CardDocument = {
      type: 'card-document',
      schemaVersion: '2',
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
})
