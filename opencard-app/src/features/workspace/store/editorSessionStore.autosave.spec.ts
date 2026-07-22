import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  schedule: vi.fn(),
  readFile: vi.fn(),
  saveProjectConfiguration: vi.fn(),
}))

vi.mock('../../../utils/taskScheduler', () => ({
  taskScheduler: {
    cancel: mocks.cancel,
    schedule: mocks.schedule,
  },
}))

vi.mock('./projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/project' },
    readFile: mocks.readFile,
    saveFile: vi.fn(),
    saveProjectConfiguration: mocks.saveProjectConfiguration,
  }),
}))

import { useEditorSessionStore } from './editorSessionStore'

describe('editorSessionStore project configuration autosave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue('{"version":1}')
    mocks.saveProjectConfiguration.mockImplementation(async (content: string) => content)
  })

  it('debounces project configuration drafts through the standard save path', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('.opencardproject')

    store.updateDraftContent(session.id, '{"version":2}')

    expect(mocks.schedule).toHaveBeenCalledWith(
      `project-configuration-autosave:${session.id}`,
      1200,
      expect.any(Function),
    )
    const scheduledSave = mocks.schedule.mock.calls[0]?.[2] as (() => Promise<void>) | undefined
    await scheduledSave?.()

    expect(mocks.saveProjectConfiguration).toHaveBeenCalledWith('{"version":2}')
    expect(store.sessions.value.find(candidate => candidate.id === session.id)).toMatchObject({
      savedContent: '{"version":2}',
      draftContent: '{"version":2}',
      isDirty: false,
    })
    store.closeSession(session.id)
  })

  it('does not autosave drafts from other editor types', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('main.opencard')

    store.updateDraftContent(session.id, '{"type":"card-document"}')

    expect(mocks.schedule).not.toHaveBeenCalled()
    store.closeSession(session.id)
  })

  it('does not overwrite a newer draft when an earlier autosave finishes', async () => {
    let finishSave: ((content: string) => void) | undefined
    mocks.saveProjectConfiguration.mockImplementationOnce(() => new Promise<string>((resolve) => {
      finishSave = resolve
    }))
    const store = useEditorSessionStore()
    const session = await store.openFile('.opencardproject')
    store.updateDraftContent(session.id, '{"version":2}')
    const firstScheduledSave = mocks.schedule.mock.calls[0]?.[2] as (() => Promise<void>) | undefined
    const saving = firstScheduledSave?.()

    store.updateDraftContent(session.id, '{"version":3}')
    finishSave?.('{"version":2}')
    await saving

    expect(store.sessions.value.find(candidate => candidate.id === session.id)).toMatchObject({
      savedContent: '{"version":2}',
      draftContent: '{"version":3}',
      isDirty: true,
    })
    expect(mocks.schedule).toHaveBeenCalledTimes(2)
    store.closeSession(session.id)
  })
})
