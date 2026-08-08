import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  saveProjectConfiguration: vi.fn(),
  saveProjectDictionary: vi.fn(),
  prepareProjectConfigurationContent: vi.fn(),
  prepareProjectDictionaryContent: vi.fn(),
}))
vi.mock('./projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/project' },
    readFile: mocks.readFile,
    saveFile: vi.fn(),
    saveProjectConfiguration: mocks.saveProjectConfiguration,
    saveProjectDictionary: mocks.saveProjectDictionary,
    prepareProjectConfigurationContent: mocks.prepareProjectConfigurationContent,
    prepareProjectDictionaryContent: mocks.prepareProjectDictionaryContent,
  }),
}))

import { setLocalHistoryRecorder, useEditorSessionStore } from './editorSessionStore'

describe('editorSessionStore project profile manual save', () => {
  beforeEach(() => {
    setLocalHistoryRecorder(null)
    const store = useEditorSessionStore()
    for (const session of store.sessions.value) {
      store.closeSession(session.id)
    }
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue('{}')
    mocks.saveProjectConfiguration.mockImplementation(async (_path: string, content: string) => content)
    mocks.saveProjectDictionary.mockImplementation(async (_path: string, content: string) => content)
    mocks.prepareProjectConfigurationContent.mockImplementation((_path: string, content: string) => content)
    mocks.prepareProjectDictionaryContent.mockImplementation((_path: string, content: string) => content)
  })

  it('keeps profile edits dirty until explicitly saved', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('.ocproject')
    store.updateDraftContent(session.id, '{"name":"Demo"}')
    expect(mocks.saveProjectConfiguration).not.toHaveBeenCalled()
    expect(store.sessions.value.find(candidate => candidate.id === session.id)?.isDirty).toBe(true)
    await store.saveSession(session.id)
    expect(mocks.saveProjectConfiguration).toHaveBeenCalledWith('.ocproject', '{"name":"Demo"}')
    expect(store.sessions.value.find(candidate => candidate.id === session.id)?.isDirty).toBe(false)
  })

  it('preserves a newer draft while an explicit save is running', async () => {
    let finishSave: ((content: string) => void) | undefined
    mocks.saveProjectConfiguration.mockImplementationOnce(() => new Promise<string>(resolve => { finishSave = resolve }))
    const store = useEditorSessionStore()
    const session = await store.openFile('.ocproject')
    store.updateDraftContent(session.id, '{"name":"First"}')
    const saving = store.saveSession(session.id)
    store.updateDraftContent(session.id, '{"name":"Second"}')
    finishSave?.('{"name":"First"}')
    await expect(saving).resolves.toMatchObject({
      status: 'saved',
      startedRevision: 1,
      persistedRevision: 1,
      currentRevision: 2,
      persistedContent: '{"name":"First"}',
      sessionStillDirty: true,
    })
    expect(store.sessions.value.find(candidate => candidate.id === session.id)).toMatchObject({
      savedContent: '{"name":"First"}',
      draftContent: '{"name":"Second"}',
      isDirty: true,
    })
  })

  it('does not let an editor clear dirty state before persistence succeeds', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('.ocproject')
    store.updateDraftContent(session.id, '{"name":"Pending"}')

    store.setSessionDirtyState(session.id, false)

    expect(store.sessions.value.find(candidate => candidate.id === session.id)).toMatchObject({
      draftContent: '{"name":"Pending"}',
      contentRevision: 1,
      isDirty: true,
    })
  })

  it('prepares the same canonical structured content without writing it', async () => {
    mocks.prepareProjectConfigurationContent.mockReturnValueOnce('{"name":"Canonical"}')
    const store = useEditorSessionStore()
    const session = await store.openFile('.ocproject')
    store.updateDraftContent(session.id, '{"name":"Draft"}')

    expect(store.prepareSessionContent(session.id)).toEqual({
      sessionId: session.id,
      relativePath: '.ocproject',
      content: '{"name":"Canonical"}',
      contentRevision: 1,
    })
    expect(mocks.saveProjectConfiguration).not.toHaveBeenCalled()
  })

  it('keeps dictionary edits isolated until explicit save', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('.oclocale')
    store.updateDraftContent(session.id, '{"base":{"title":"Hello"}}')
    expect(mocks.saveProjectDictionary).not.toHaveBeenCalled()

    await store.saveSession(session.id)
    expect(mocks.saveProjectDictionary).toHaveBeenCalledWith(
      '.oclocale',
      '{"base":{"title":"Hello"}}',
    )
  })

  it('records the exact persisted content after an explicit save', async () => {
    const recordLocalHistory = vi.fn(async () => 'recorded' as const)
    setLocalHistoryRecorder(recordLocalHistory)
    const store = useEditorSessionStore()
    const session = await store.openFile('notes.txt')
    store.updateDraftContent(session.id, 'saved text')

    const receipt = await store.saveSession(session.id, undefined, 'manual-save')

    expect(recordLocalHistory).toHaveBeenCalledWith({
      projectRoot: 'D:/project',
      relativePath: 'notes.txt',
      content: 'saved text',
      source: 'manual-save',
    })
    expect(receipt).toMatchObject({ status: 'saved', localHistory: 'recorded' })
  })
})
