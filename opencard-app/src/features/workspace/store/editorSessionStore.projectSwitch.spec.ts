import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  saveFile: vi.fn(),
  writeFile: vi.fn(),
  readExternalFile: vi.fn(),
}))

vi.mock('./projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/old-project' },
    readFile: mocks.readFile,
    saveFile: mocks.saveFile,
  }),
}))

vi.mock('../services/fileSystemService', () => ({
  fileSystemService: {
    writeFile: mocks.writeFile,
    readFile: mocks.readExternalFile,
  },
}))

import { useEditorSessionStore } from './editorSessionStore'
import { taskScheduler } from '../../../utils/taskScheduler'

describe('editorSessionStore project switching', () => {
  beforeEach(() => {
    const store = useEditorSessionStore()
    for (const session of store.sessions.value) {
      store.closeSession(session.id)
    }
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue('{"project":"old"}')
    mocks.saveFile.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
    mocks.readExternalFile.mockResolvedValue('{"external":true}')
  })

  it('detaches workspace sessions without losing identity, edits, active state, or UI state', async () => {
    const store = useEditorSessionStore()
    const previewSession = await store.openPreviewFile('preview.opencard')
    const oldSession = await store.openFile('main.opencard')
    store.updateDraftContent(oldSession.id, '{"project":"edited"}')
    store.updateSessionUiState(oldSession.id, {
      cardDesigner: {
        viewportTransform: { x: 12, y: 24, scale: 1.5 },
      },
    })
    const pendingAutosave = vi.fn()
    const autosaveKey = `project-configuration-autosave:${oldSession.id}`
    taskScheduler.schedule(autosaveKey, 60_000, pendingAutosave)

    store.detachWorkspaceSessions('D:\\old-project\\')
    await taskScheduler.flush(autosaveKey)

    expect(store.sessions.value).toContainEqual(expect.objectContaining({
      id: oldSession.id,
      resourceKind: 'external',
      path: 'D:/old-project/main.opencard',
      savedContent: '{"project":"old"}',
      draftContent: '{"project":"edited"}',
      isDirty: true,
      uiState: {
        cardDesigner: {
          viewportTransform: { x: 12, y: 24, scale: 1.5 },
        },
      },
    }))
    expect(store.activeSessionId.value).toBe(oldSession.id)
    expect(pendingAutosave).not.toHaveBeenCalled()
    expect(store.sessions.value.find((session) => session.id === previewSession.id)).toMatchObject({
      resourceKind: 'external',
      path: 'D:/old-project/preview.opencard',
      isPreview: true,
    })

    const newSession = await store.openFile('main.opencard')
    expect(newSession.id).not.toBe(oldSession.id)
    expect(newSession.resourceKind).toBe('workspace')
    store.closeSession(previewSession.id)
    store.closeSession(oldSession.id)
    store.closeSession(newSession.id)
  })

  it('keeps absolute workspace paths absolute and leaves external and draft sessions unchanged', async () => {
    const store = useEditorSessionStore()
    const workspaceSession = await store.openFile('D:/old-project/cards/main.opencard')
    const externalSession = await store.openFile('D:/outside/card.opencard')
    const draftSession = store.createDraftSession({ name: 'draft.opencard' })
    const externalSnapshot = structuredClone(externalSession)
    const draftSnapshot = structuredClone(draftSession)

    store.detachWorkspaceSessions('D:/old-project')

    expect(store.sessions.value.find((session) => session.id === workspaceSession.id)).toMatchObject({
      resourceKind: 'external',
      path: 'D:/old-project/cards/main.opencard',
    })
    expect(store.sessions.value.find((session) => session.id === externalSession.id)).toStrictEqual(externalSnapshot)
    expect(store.sessions.value.find((session) => session.id === draftSession.id)).toStrictEqual(draftSnapshot)

    store.closeSession(workspaceSession.id)
    store.closeSession(externalSession.id)
    store.closeSession(draftSession.id)
  })

  it('still closes workspace sessions on explicit project close', async () => {
    const store = useEditorSessionStore()
    const workspaceSession = await store.openFile('main.opencard')
    const externalSession = await store.openFile('D:/outside/card.opencard')

    store.closeWorkspaceSessions()

    expect(store.sessions.value.some((session) => session.id === workspaceSession.id)).toBe(false)
    expect(store.sessions.value.map((session) => session.id)).toEqual([externalSession.id])
    expect(store.activeSessionId.value).toBe(externalSession.id)
    store.closeSession(externalSession.id)
  })

  it('closes sessions at and below a deleted workspace path', async () => {
    const store = useEditorSessionStore()
    const retained = await store.openFile('other.opencard')
    const removed = await store.openFile('cards/main.opencard')

    store.closeSessionsByPath('cards')

    expect(store.sessions.value.map((session) => session.id)).toEqual([retained.id])
    expect(store.activeSessionId.value).toBe(retained.id)
    expect(store.sessions.value.some((session) => session.id === removed.id)).toBe(false)
    store.closeSession(retained.id)
  })

  it('opens absolute paths outside the project as external sessions', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('D:/outside/card.opencard')

    expect(session).toMatchObject({
      resourceKind: 'external',
      path: 'D:/outside/card.opencard',
      draftContent: '{"external":true}',
    })
    expect(mocks.readExternalFile).toHaveBeenCalledWith('D:/outside/card.opencard')
    expect(mocks.readFile).not.toHaveBeenCalled()
    store.closeSession(session.id)
  })
})
