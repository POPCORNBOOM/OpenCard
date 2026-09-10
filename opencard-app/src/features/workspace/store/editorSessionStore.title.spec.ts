import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  readExternalFile: vi.fn(),
  pickSavePath: vi.fn(),
}))

vi.mock('./projectStore', () => ({
  useProjectStore: () => ({
    projectPath: { value: 'D:/project' },
    readFile: mocks.readFile,
    saveFile: vi.fn(async () => undefined),
  }),
}))

vi.mock('../services/fileSystemService', () => ({
  fileSystemService: {
    readFile: mocks.readExternalFile,
    writeFile: vi.fn(async () => undefined),
    pickSavePath: mocks.pickSavePath,
  },
}))

import { useEditorSessionStore } from './editorSessionStore'

function cardDocumentContent(name: string): string {
  return JSON.stringify({ type: 'card-document', name, faces: {} })
}

describe('editorSessionStore session titles', () => {
  beforeEach(() => {
    const store = useEditorSessionStore()
    for (const session of store.sessions.value) {
      store.closeSession(session.id)
    }
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue(cardDocumentContent('card'))
    mocks.readExternalFile.mockResolvedValue(cardDocumentContent('external'))
  })

  it('keeps the file name as the label when no explicit title is set', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('cards/main.ocdocument')

    expect(session.title).toBeUndefined()
    expect(store.openedEditorItems.value.find(item => item.key === session.id)).toEqual({
      key: session.id,
      label: 'main.ocdocument',
      resourceKind: 'workspace',
      icon: 'file.opencard',
      iconTone: 'opencard',
    })
  })

  it('labels an opened file with its explicit title while keeping the file name identity', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('D:/project/.opencard/packages/packages.json', { title: '包' })

    expect(session.name).toBe('packages.json')
    expect(session.title).toBe('包')
    expect(store.openedEditorItems.value.find(item => item.key === session.id)).toMatchObject({
      label: 'packages.json',
      title: '包',
    })

    store.setSessionDirtyState(session.id, true)
    expect(store.openedEditorItems.value.find(item => item.key === session.id)?.label).toBe('packages.json *')

    store.setSessionDirtyState(session.id, false)
    expect(store.openedEditorItems.value.find(item => item.key === session.id)?.label).toBe('packages.json')
  })

  it('reuses an existing session and applies a title passed by the second open', async () => {
    const store = useEditorSessionStore()
    const first = await store.openPreviewFile('cards/main.ocdocument')
    const second = await store.openFile('cards/main.ocdocument', { title: '主卡' })

    expect(second.id).toBe(first.id)
    expect(store.sessions.value).toHaveLength(1)
    expect(store.openedEditorItems.value[0]?.title).toBe('主卡')
  })

  it('drops an explicit title once the session name is derived again', async () => {
    const store = useEditorSessionStore()
    const draft = store.createDraftSession({ name: 'draft.ocdocument', title: '草稿占位' })

    expect(store.openedEditorItems.value[0]?.title).toBe('草稿占位')
    expect(draft.name).toBe('draft.ocdocument')

    store.updateDraftContent(draft.id, cardDocumentContent('卡片A'))
    store.updateDraftContent(draft.id, cardDocumentContent('红桃A'))

    expect(store.sessions.value[0]?.name).toBe('红桃A.ocdocument')
    expect(store.sessions.value[0]?.title).toBeUndefined()
    expect(store.openedEditorItems.value[0]?.title).toBeUndefined()
  })

  it('drops an explicit title when a rename rewrites the file name', async () => {
    const store = useEditorSessionStore()
    const session = await store.openFile('D:/project/cards/main.ocdocument', { title: '主卡' })

    store.remapSessionPaths('D:/project/cards', 'D:/project/archive')

    const renamed = store.sessions.value.find(candidate => candidate.id === session.id)
    expect(renamed?.name).toBe('main.ocdocument')
    expect(renamed?.path).toBe('D:/project/archive/main.ocdocument')
    expect(renamed?.title).toBeUndefined()
    expect(store.openedEditorItems.value[0]?.title).toBeUndefined()
  })

  it('drops an explicit title when the session is saved to a new path', async () => {
    const store = useEditorSessionStore()
    const draft = store.createDraftSession({ title: '未命名占位' })
    store.updateDraftContent(draft.id, '{"type":"card-document","name":"卡片","faces":{}}')

    await store.saveSession(draft.id, 'D:/project/cards/卡片.ocdocument')

    const saved = store.sessions.value.find(candidate => candidate.id === draft.id)
    expect(saved?.name).toBe('卡片.ocdocument')
    expect(saved?.title).toBeUndefined()
  })
})
