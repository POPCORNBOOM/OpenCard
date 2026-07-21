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

  it('closes old workspace sessions before opening the same relative path in a new project', async () => {
    const store = useEditorSessionStore()
    const oldSession = await store.openFile('main.opencard')

    store.closeWorkspaceSessions()

    expect(store.sessions.value).not.toContainEqual(expect.objectContaining({ id: oldSession.id }))
    expect(store.activeSessionId.value).toBe('')

    const newSession = await store.openFile('main.opencard')
    expect(newSession.id).not.toBe(oldSession.id)
    expect(newSession.resourceKind).toBe('workspace')
    store.closeSession(newSession.id)
  })
})
