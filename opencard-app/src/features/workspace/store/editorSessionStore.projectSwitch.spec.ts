import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  saveFile: vi.fn(),
  writeFile: vi.fn(),
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
  },
}))

import { useEditorSessionStore } from './editorSessionStore'

describe('editorSessionStore project switching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue('{"project":"old"}')
    mocks.saveFile.mockResolvedValue(undefined)
    mocks.writeFile.mockResolvedValue(undefined)
  })

  it('detaches old workspace sessions before opening the same relative path in a new project', async () => {
    const store = useEditorSessionStore()
    const oldSession = await store.openFile('main.opencard')
    store.updateDraftContent(oldSession.id, '{"project":"old-draft"}')

    store.detachWorkspaceSessions('D:\\old-project\\')

    const detached = store.sessions.value.find((session) => session.id === oldSession.id)
    expect(detached).toMatchObject({
      resourceKind: 'external',
      path: 'D:/old-project/main.opencard',
      draftContent: '{"project":"old-draft"}',
      isDirty: true,
    })

    const newSession = await store.openFile('main.opencard')
    expect(newSession.id).not.toBe(oldSession.id)
    expect(newSession.resourceKind).toBe('workspace')

    await store.saveSession(oldSession.id)
    expect(mocks.writeFile).toHaveBeenCalledWith(
      'D:/old-project/main.opencard',
      '{"project":"old-draft"}',
    )
    expect(mocks.saveFile).not.toHaveBeenCalled()

    store.closeSession(oldSession.id)
    store.closeSession(newSession.id)
  })
})
