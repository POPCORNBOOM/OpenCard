import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inspectRepository: vi.fn(),
  readHistory: vi.fn(),
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
    mocks.readHistory.mockResolvedValue(ok([]))
  })

  it('stays empty without a project and shows uninitialized projects', async () => {
    const path = ref<string | null>(null)
    const state = useProjectTimeline(path, ref('en-US'))
    await nextTick()
    expect(state.treeData.value.rootKeys).toEqual([])
    expect(mocks.inspectRepository).not.toHaveBeenCalled()

    path.value = 'D:/Cards/demo'
    mocks.inspectRepository.mockResolvedValueOnce(ok({ ...repository, initialized: false }))
    await vi.waitFor(() => expect(state.initialized.value).toBe(false))
    expect(mocks.readHistory).not.toHaveBeenCalled()
  })

  it('maps history into read-only tree items and formats the authored time', async () => {
    mocks.readHistory.mockResolvedValueOnce(ok([{
      id: 'abcdef123', shortId: 'abcdef1', summary: 'First card', message: 'First card',
      authorName: 'Author', authorEmail: 'author@example.com', authoredAtSeconds: 0, parentIds: [],
    }]))
    const state = useProjectTimeline(ref('D:/Cards/demo'), ref('en-US'))
    await vi.waitFor(() => expect(state.treeData.value.rootKeys).toEqual(['timeline:abcdef123']))
    const item = state.treeData.value.items.get('timeline:abcdef123')
    expect(item?.label).toBe('First card')
    expect(item?.icon).toBe('file.git')
    expect(item?.tail).toContain('1970')
  })

  it('ignores a stale response after switching projects', async () => {
    let resolveFirst: ((value: unknown) => void) | undefined
    mocks.inspectRepository.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
    const path = ref<string | null>('D:/Cards/first')
    const state = useProjectTimeline(path, ref('en-US'))
    path.value = 'D:/Cards/second'
    await vi.waitFor(() => expect(mocks.inspectRepository).toHaveBeenCalledTimes(2))
    resolveFirst?.(ok(repository))
    await nextTick()
    expect(state.treeData.value.rootKeys).toEqual([])
  })

  it('turns an IPC rejection into a retryable timeline error state', async () => {
    mocks.inspectRepository.mockRejectedValueOnce(new Error('channel unavailable'))
    const state = useProjectTimeline(ref('D:/Cards/demo'), ref('en-US'))

    await vi.waitFor(() => expect(state.errorKind.value).toBe('io'))
    expect(state.initialized.value).toBe(false)
    expect(state.loading.value).toBe(false)
  })
})
