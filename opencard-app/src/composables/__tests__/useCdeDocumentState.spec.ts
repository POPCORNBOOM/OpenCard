import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCdeDocumentState } from '../useCdeDocumentState'

function createRawDocument() {
  return JSON.stringify({
    type: 'card-document',
    name: 'Demo Card',
    id: 'doc-1',
    version: '1.0.0',
    width: 540,
    height: 850,
    children: [],
    instances: [],
  }, null, 2)
}

describe('useCdeDocumentState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces typing changes into one history entry and supports undo/redo', async () => {
    const emitModelValueUpdate = vi.fn()
    const emitModified = vi.fn()

    const state = useCdeDocumentState({
      emitModelValueUpdate,
      emitModified,
      emitSave: vi.fn(),
      resetSelection: vi.fn(),
      getDefaultDocumentName: () => 'OpenCard Document',
    })

    state.loadRawDoc(createRawDocument())
    expect(state.canUndo.value).toBe(false)

    if (!state.cardDoc.value) {
      throw new Error('Expected cardDoc after load')
    }

    state.cardDoc.value.name = 'Typing A'
    state.markDocumentChanged('typing')
    state.cardDoc.value.name = 'Typing B'
    state.markDocumentChanged('typing')

    vi.advanceTimersByTime(299)
    expect(emitModelValueUpdate).toHaveBeenCalledTimes(0)

    vi.advanceTimersByTime(1)
    expect(emitModelValueUpdate).toHaveBeenCalledTimes(1)
    expect(state.canUndo.value).toBe(true)

    await state.undo()
    expect(state.cardDoc.value?.name).toBe('Demo Card')
    expect(state.canRedo.value).toBe(true)

    await state.redo()
    expect(state.cardDoc.value?.name).toBe('Typing B')
  })

  it('flushes pending typing changes before save', async () => {
    const emitModelValueUpdate = vi.fn()
    const emitModified = vi.fn()
    const emitSave = vi.fn()

    const state = useCdeDocumentState({
      emitModelValueUpdate,
      emitModified,
      emitSave,
      resetSelection: vi.fn(),
      getDefaultDocumentName: () => 'OpenCard Document',
    })

    state.loadRawDoc(createRawDocument())
    if (!state.cardDoc.value) {
      throw new Error('Expected cardDoc after load')
    }

    state.cardDoc.value.name = 'Saved Name'
    state.markDocumentChanged('typing')

    await state.saveFile()

    expect(emitSave).toHaveBeenCalledTimes(1)
    expect(state.isModified.value).toBe(false)
    expect(emitModelValueUpdate).toHaveBeenCalled()
    const lastCall = emitModelValueUpdate.mock.calls[emitModelValueUpdate.mock.calls.length - 1]
    expect(lastCall?.[0]).toContain('"name": "Saved Name"')
  })
})
