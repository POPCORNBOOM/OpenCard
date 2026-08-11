import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardDocument } from '../../entities/card/model'
import { serializeCardDocument } from '../../entities/card/storage'
import { useCdeDocumentState } from './useCdeDocumentState'

function createDocument(): CardDocument {
  return {
    type: 'card-document',

    id: 'document',
    name: 'Before typing',
    version: '1.0.0',
    width: '540',
    height: '850',
    faces: {
      front: { type: 'card-face', id: 'front', background: '#FFFFFF', children: [] },
      back: { type: 'card-face', id: 'back', background: '#FFFFFF', children: [] },
    },
    instances: [],
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('useCdeDocumentState lifecycle', () => {
  it('flushes pending typing before disposal', () => {
    vi.useFakeTimers()
    const emitModelValueUpdate = vi.fn()
    const state = useCdeDocumentState({
      emitModelValueUpdate,
      emitModified: vi.fn(),
      emitSave: vi.fn(),
      resetSelection: vi.fn(),
    })
    state.loadRawDoc(serializeCardDocument(createDocument()))
    emitModelValueUpdate.mockClear()

    state.cardDoc.value!.name = 'Latest typing'
    state.markDocumentChanged('typing')
    state.dispose()

    expect(emitModelValueUpdate).toHaveBeenCalledTimes(1)
    expect(JSON.parse(emitModelValueUpdate.mock.calls[0]![0])).toMatchObject({
      name: 'Latest typing',
    })
    expect(vi.getTimerCount()).toBe(0)
  })
})
