import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  writeFile: vi.fn(),
  pickSavePath: vi.fn(),
}))

vi.mock('./projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/project' },
    readFile: vi.fn(),
    saveFile: vi.fn(),
    saveProjectConfiguration: vi.fn(),
    saveProjectDictionary: vi.fn(),
  }),
}))

vi.mock('../services/fileSystemService', () => ({
  fileSystemService: {
    writeFile: mocks.writeFile,
    pickSavePath: mocks.pickSavePath,
  },
}))

import { useEditorSessionStore } from './editorSessionStore'

describe('editorSessionStore explicit save path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.writeFile.mockResolvedValue(undefined)
  })

  it('persists a draft to the supplied path without opening Save As', async () => {
    const store = useEditorSessionStore()
    const session = store.createDraftSession({
      name: 'Draft.ocdocument',
      content: '{"draft":true}',
    })

    await expect(store.saveSession(session.id, 'D:/exports/Draft.ocdocument')).resolves.toMatchObject({
      status: 'saved',
      sessionId: session.id,
      resourceKind: 'external',
      path: 'D:/exports/Draft.ocdocument',
      persistedRevision: 0,
      currentRevision: 0,
      sessionStillDirty: false,
    })

    expect(mocks.pickSavePath).not.toHaveBeenCalled()
    expect(mocks.writeFile).toHaveBeenCalledWith('D:/exports/Draft.ocdocument', '{"draft":true}')
    expect(store.sessions.value.find(candidate => candidate.id === session.id)).toMatchObject({
      resourceKind: 'external',
      path: 'D:/exports/Draft.ocdocument',
      savedContent: '{"draft":true}',
      draftContent: '{"draft":true}',
      isDirty: false,
    })

    store.closeSession(session.id)
  })

  it('uses the current OpenCard document name across draft display and Save As', async () => {
    const store = useEditorSessionStore()
    const session = store.createDraftSession({
      name: 'Untitled-1.ocdocument',
      content: JSON.stringify({ type: 'card-document', name: 'Current Card' }),
    })
    mocks.pickSavePath.mockResolvedValueOnce(null)

    expect(session.name).toBe('Current Card.ocdocument')
    expect(store.openedEditorItems.value.find(item => item.key === session.id)?.label)
      .toBe('Current Card.ocdocument')

    await expect(store.saveSession(session.id)).resolves.toMatchObject({
      status: 'cancelled',
      sessionId: session.id,
    })
    expect(mocks.pickSavePath).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: 'Current Card.ocdocument',
    }))

    store.closeSession(session.id)
  })

  it('updates only an OpenCard draft name when its document name changes', () => {
    const store = useEditorSessionStore()
    const session = store.createDraftSession({
      name: 'Untitled-1.ocdocument',
      content: JSON.stringify({ type: 'card-document', name: 'Before' }),
    })

    store.updateDraftContent(
      session.id,
      JSON.stringify({ type: 'card-document', name: 'After' }),
    )

    expect(store.sessions.value.find(candidate => candidate.id === session.id)?.name)
      .toBe('After.ocdocument')
    expect(store.openedEditorItems.value.find(item => item.key === session.id)?.label)
      .toBe('After.ocdocument *')

    store.closeSession(session.id)
  })
})
