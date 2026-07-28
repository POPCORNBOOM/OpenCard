import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type {
  EditorSession,
  SessionSaveResult,
} from '../../workspace/store/editorSessionStore'
import { useUnsavedSessionGuard } from './useUnsavedSessionGuard'

function createSession(
  id: string,
  patch: Partial<EditorSession> = {},
): EditorSession {
  return {
    id,
    resourceKind: 'workspace',
    path: `${id}.opencard`,
    fileTypeId: 'opencard',
    name: `${id}.opencard`,
    editorId: 'card-designer',
    savedContent: '{}',
    draftContent: '{}',
    isDirty: false,
    isPreview: false,
    ...patch,
  }
}

function createGuard(sessions: EditorSession[]) {
  const completeClose = vi.fn(async () => undefined)
  const saveSession = vi.fn<(
    sessionId: string,
    targetPath?: string,
  ) => Promise<SessionSaveResult>>(async () => 'saved')
  const pickDraftDirectory = vi.fn<() => Promise<string | null>>(async () => 'D:/drafts')
  const fileExists = vi.fn<(path: string) => Promise<boolean>>(async () => false)
  const guard = useUnsavedSessionGuard({
    sessions: ref(sessions),
    completeClose,
    saveSession,
    pickDraftDirectory,
    fileExists,
  })
  return { guard, completeClose, saveSession, pickDraftDirectory, fileExists }
}

describe('useUnsavedSessionGuard', () => {
  it('protects an untouched draft but immediately closes clean persisted sessions', async () => {
    const draft = createSession('draft', {
      resourceKind: 'draft',
      path: null,
      isDirty: false,
    })
    const clean = createSession('clean')
    const { guard, completeClose } = createGuard([draft, clean])

    await expect(guard.requestClose({ type: 'sessions', sessionIds: [clean.id] })).resolves.toBe('completed')
    await expect(guard.requestClose({ type: 'sessions', sessionIds: [draft.id] })).resolves.toBe('prompted')

    expect(completeClose).toHaveBeenCalledTimes(1)
    expect(guard.decisions.value).toMatchObject([{
      sessionId: draft.id,
      decision: 'pending',
      selected: true,
    }])
  })

  it('preserves the requested page destination through a clean project close', async () => {
    const clean = createSession('clean')
    const { guard, completeClose } = createGuard([clean])
    const intent = {
      type: 'project' as const,
      sessionIds: [clean.id],
      projectDestination: 'welcome' as const,
    }

    await expect(guard.requestClose(intent)).resolves.toBe('completed')
    expect(completeClose).toHaveBeenCalledWith(intent)
  })

  it('preserves project creation as a post-close destination', async () => {
    const clean = createSession('clean')
    const { guard, completeClose } = createGuard([clean])
    const intent = {
      type: 'project' as const,
      sessionIds: [clean.id],
      projectDestination: 'create-project' as const,
    }

    await expect(guard.requestClose(intent)).resolves.toBe('completed')
    expect(completeClose).toHaveBeenCalledWith(intent)
  })

  it('removes checkboxes from decided rows and restores them only through change', async () => {
    const first = createSession('first', { isDirty: true })
    const second = createSession('second', { isDirty: true })
    const { guard } = createGuard([first, second])
    await guard.requestClose({ type: 'sessions', sessionIds: [first.id, second.id] })

    guard.setRowSelected(second.id, false)
    guard.markSelectedDiscard()

    expect(guard.decisions.value.find(row => row.sessionId === first.id)).toMatchObject({
      decision: 'discard',
      selected: false,
    })
    expect(guard.decisions.value.find(row => row.sessionId === second.id)).toMatchObject({
      decision: 'pending',
      selected: false,
    })
    expect(guard.canConfirm.value).toBe(false)

    guard.resetDecision(first.id)
    expect(guard.decisions.value.find(row => row.sessionId === first.id)).toMatchObject({
      decision: 'pending',
      selected: false,
    })
  })

  it('chooses one directory for many drafts and avoids existing target names', async () => {
    const first = createSession('first', {
      resourceKind: 'draft', path: null, name: 'Card Name.opencard',
    })
    const second = createSession('second', {
      resourceKind: 'draft', path: null, name: 'Card Name.opencard',
    })
    const { guard, pickDraftDirectory, fileExists } = createGuard([first, second])
    fileExists.mockImplementation(async (path: string) => path === 'D:/drafts/Card Name.opencard')
    await guard.requestClose({ type: 'app', sessionIds: [first.id, second.id] })

    await expect(guard.markSelectedSave()).resolves.toBe(true)

    expect(pickDraftDirectory).toHaveBeenCalledTimes(1)
    expect(guard.decisions.value.map(row => row.name)).toEqual([
      'Card Name.opencard',
      'Card Name.opencard',
    ])
    expect(guard.decisions.value.map(row => row.savePath)).toEqual([
      'D:/drafts/Card Name-2.opencard',
      'D:/drafts/Card Name-3.opencard',
    ])
    expect(guard.decisions.value.every(row => row.decision === 'save' && !row.selected)).toBe(true)
    expect(guard.canConfirm.value).toBe(true)
  })

  it('keeps draft decisions pending when directory selection is cancelled', async () => {
    const draft = createSession('draft', { resourceKind: 'draft', path: null })
    const { guard, pickDraftDirectory } = createGuard([draft])
    pickDraftDirectory.mockResolvedValueOnce(null)
    await guard.requestClose({ type: 'app', sessionIds: [draft.id] })

    await expect(guard.markSelectedSave()).resolves.toBe(false)

    expect(guard.decisions.value[0]).toMatchObject({ decision: 'pending', selected: true })
    expect(guard.isOpen.value).toBe(true)
  })

  it('saves decided rows before completing the destructive close', async () => {
    const save = createSession('save', { isDirty: true })
    const discard = createSession('discard', { isDirty: true })
    const { guard, saveSession, completeClose } = createGuard([save, discard])
    await guard.requestClose({ type: 'app', sessionIds: [save.id, discard.id] })
    guard.setRowSelected(discard.id, false)
    await guard.markSelectedSave()
    guard.setAllPendingSelected(true)
    guard.markSelectedDiscard()

    await expect(guard.confirm()).resolves.toBe(true)

    expect(saveSession).toHaveBeenCalledWith(save.id, undefined)
    expect(saveSession.mock.invocationCallOrder[0]).toBeLessThan(completeClose.mock.invocationCallOrder[0]!)
    expect(completeClose).toHaveBeenCalledWith({
      type: 'app',
      sessionIds: [save.id, discard.id],
    })
    expect(guard.isOpen.value).toBe(false)
  })

  it('keeps the close blocked when any save fails', async () => {
    const session = createSession('failed', { isDirty: true })
    const { guard, saveSession, completeClose } = createGuard([session])
    saveSession.mockResolvedValueOnce('skipped')
    await guard.requestClose({ type: 'app', sessionIds: [session.id] })
    await guard.markSelectedSave()

    await expect(guard.confirm()).resolves.toBe(false)

    expect(completeClose).not.toHaveBeenCalled()
    expect(guard.decisions.value[0]?.error).toBe('save-failed')
    expect(guard.isOpen.value).toBe(true)
  })
})
