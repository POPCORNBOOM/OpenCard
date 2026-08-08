import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CardDocument } from '../../entities/card/model'
import { serializeCardDocument } from '../../entities/card/storage'
import { useCdeDocumentState } from './useCdeDocumentState'

function createDocument(): CardDocument {
  return {
    type: 'card-document',
    schemaVersion: '2',
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

  it('keeps the dirty baseline until the host confirms persistence', async () => {
    const emitModified = vi.fn()
    const emitModelValueUpdate = vi.fn()
    const state = useCdeDocumentState({
      emitModelValueUpdate,
      emitModified,
      emitSave: vi.fn(),
      resetSelection: vi.fn(),
    })
    const content = serializeCardDocument(createDocument())
    state.loadRawDoc(content)

    state.cardDoc.value!.name = 'Unsaved document'
    state.markDocumentChanged()
    await state.saveFile()

    expect(state.isModified.value).toBe(true)
    const persistedContent = emitModelValueUpdate.mock.lastCall?.[0] as string
    state.markSaved(persistedContent)
    expect(state.isModified.value).toBe(false)
    expect(emitModified).toHaveBeenLastCalledWith(false)

    state.cardDoc.value!.name = 'Newer draft'
    state.markDocumentChanged()
    state.markSaved(persistedContent)
    expect(state.isModified.value).toBe(true)
  })

  it('does not emit persistence intents in read-only mode', async () => {
    const emitModelValueUpdate = vi.fn()
    const emitModified = vi.fn()
    const emitSave = vi.fn()
    const state = useCdeDocumentState({
      emitModelValueUpdate,
      emitModified,
      emitSave,
      resetSelection: vi.fn(),
      readOnly: true,
    })
    state.loadRawDoc(serializeCardDocument(createDocument()))
    state.cardDoc.value!.name = 'Observed mutation'
    state.markDocumentChanged()
    await state.saveFile()
    await state.undo()
    await state.redo()

    expect(emitModelValueUpdate).not.toHaveBeenCalled()
    expect(emitModified).not.toHaveBeenCalled()
    expect(emitSave).not.toHaveBeenCalled()
  })
})
