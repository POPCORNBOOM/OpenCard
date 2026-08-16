import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inspectRepository: vi.fn(),
  readFileHistory: vi.fn(),
}))

vi.mock('./gitService', () => mocks)

import { useProjectTimeline } from './useProjectTimeline'

const ok = <T>(value: T) => ({
  ok: true,
  value,
  error: null,
  retryable: false,
  authenticationRequired: false,
  conflicted: false,
  continuable: false,
  abortable: false,
})

const repository = {
  initialized: true,
  projectRoot: 'D:/Cards/demo',
  head: 'abc',
  currentBranch: 'main',
  state: 'clean',
  hasConflicts: false,
  hasChanges: false,
}

describe('useProjectTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inspectRepository.mockResolvedValue(ok(repository))
    mocks.readFileHistory.mockResolvedValue(ok([]))
  })

  it('stays empty without a current project file', async () => {
    const path = ref<string | null>(null)
    const file = ref<string | null>(null)
    const state = useProjectTimeline(path, file, ref('en-US'))
    await nextTick()
    expect(state.treeData.value.rootKeys).toEqual([])
    expect(mocks.inspectRepository).not.toHaveBeenCalled()

    path.value = 'D:/Cards/demo'
    await nextTick()
    expect(mocks.inspectRepository).not.toHaveBeenCalled()
  })

  it('shows an uninitialized project without requesting file history', async () => {
    mocks.inspectRepository.mockResolvedValueOnce(ok({ ...repository, initialized: false }))
    const state = useProjectTimeline(
      ref('D:/Cards/demo'),
      ref('cards/main.ocdocument'),
      ref('en-US'),
    )

    await vi.waitFor(() => expect(state.initialized.value).toBe(false))
    expect(mocks.readFileHistory).not.toHaveBeenCalled()
  })

  it('maps the current file history into tree items and formats the authored time', async () => {
    mocks.readFileHistory.mockResolvedValueOnce(ok([{
      id: 'abcdef123', shortId: 'abcdef1', summary: 'First card', message: 'First card',
      authorName: 'Author', authorEmail: 'author@example.com', authoredAtSeconds: 0, parentIds: [],
    }]))
    const state = useProjectTimeline(
      ref('D:/Cards/demo'),
      ref('cards/main.ocdocument'),
      ref('en-US'),
    )
    await vi.waitFor(() => expect(state.treeData.value.rootKeys).toEqual(['timeline:abcdef123']))
    expect(mocks.readFileHistory).toHaveBeenCalledWith('D:/Cards/demo', {
      path: 'cards/main.ocdocument',
      limit: 50,
    })
    const item = state.treeData.value.items.get('timeline:abcdef123')
    expect(item?.label).toBe('First card')
    expect(item?.icon).toBe('file.git')
    expect(item?.tail).toContain('1970')
  })

  it('ignores a stale history response after switching files', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    mocks.readFileHistory.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
    const file = ref<string | null>('cards/first.ocdocument')
    const state = useProjectTimeline(ref('D:/Cards/demo'), file, ref('en-US'))
    await vi.waitFor(() => expect(mocks.readFileHistory).toHaveBeenCalledOnce())
    file.value = 'cards/second.ocdocument'
    await vi.waitFor(() => expect(mocks.readFileHistory).toHaveBeenCalledTimes(2))
    resolveFirst?.(ok([{
      id: 'stale', shortId: 'stale', summary: 'Stale commit', message: 'Stale commit',
      authorName: 'Author', authorEmail: 'author@example.com', authoredAtSeconds: 0, parentIds: [],
    }]))
    await nextTick()
    expect(state.treeData.value.rootKeys).toEqual([])
  })

  it('turns an IPC rejection into a retryable timeline error state', async () => {
    mocks.inspectRepository.mockRejectedValueOnce(new Error('channel unavailable'))
    const state = useProjectTimeline(
      ref('D:/Cards/demo'),
      ref('cards/main.ocdocument'),
      ref('en-US'),
    )

    await vi.waitFor(() => expect(state.errorKind.value).toBe('io'))
    expect(state.initialized.value).toBe(false)
    expect(state.loading.value).toBe(false)
  })
})
