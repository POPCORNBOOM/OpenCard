import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  inspectRepository: vi.fn(),
  readFileHistory: vi.fn(),
  readHistory: vi.fn(),
  readStatus: vi.fn(),
  initializeRepository: vi.fn(),
  stageAll: vi.fn(),
  createCommit: vi.fn(),
}))
vi.mock('../../version-control/gitService', () => mocks)

import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { useShellVersionControl } from './useShellVersionControl'

const PROJECT_ROOT = 'D:/Cards/demo'
const DOCUMENT_PATH = 'cards/main.ocdocument'
const IDENTITY = { name: 'Author', email: 'author@example.com' }

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

const failure = (message: string) => ({
  ok: false,
  value: null,
  error: { kind: 'git' as const, message, retryable: false, authenticationRequired: false },
  retryable: false,
  authenticationRequired: false,
  conflicted: false,
  continuable: false,
  abortable: false,
})

const repository = (initialized: boolean) => ({
  initialized,
  projectRoot: PROJECT_ROOT,
  head: null,
  currentBranch: null,
  state: 'clean',
  hasConflicts: false,
  hasChanges: false,
})

const commitSummary = (
  id: string,
  changedFiles: Array<{ path: string, status: 'added' | 'modified' | 'deleted' }> = [],
) => ({
  id,
  shortId: id.slice(0, 7),
  summary: `Commit ${id}`,
  message: `Commit ${id}`,
  authorName: 'Author',
  authorEmail: 'author@example.com',
  authoredAtSeconds: 0,
  parentIds: [],
  changedFiles,
})

function workspaceSession(): EditorSession {
  return {
    id: 'session-1',
    resourceKind: 'workspace',
    path: `${PROJECT_ROOT}/${DOCUMENT_PATH}`,
    fileTypeId: 'opencard',
    name: 'main.ocdocument',
    editorId: 'opencard',
    savedContent: '',
    draftContent: '',
    isDirty: false,
    isPreview: false,
    mode: 'edit',
  }
}

function createVersionControl() {
  const projectPath = ref('')
  const activeSession = ref<EditorSession | null>(null)
  const fileChangeRevision = ref(0)
  const versionControl = useShellVersionControl({
    projectPath,
    activeSession,
    locale: ref('en-US'),
    translate: key => key,
    fileChangeRevision,
    getRelativeProjectPath: path => path.slice(`${PROJECT_ROOT}/`.length),
  })
  return { versionControl, projectPath, activeSession, fileChangeRevision }
}

describe('useShellVersionControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.inspectRepository.mockResolvedValue(ok(repository(true)))
    mocks.readHistory.mockResolvedValue(ok([]))
    mocks.readFileHistory.mockResolvedValue(ok([]))
    mocks.readStatus.mockResolvedValue(ok({ entries: [] }))
    mocks.initializeRepository.mockResolvedValue(ok(true))
    mocks.stageAll.mockResolvedValue(ok(true))
    mocks.createCommit.mockResolvedValue(ok({ id: 'commit-1' }))
  })

  it('derives repository readiness and the timeline placeholder from the repository inspection', async () => {
    const { versionControl, projectPath, activeSession } = createVersionControl()

    expect(versionControl.repositoryReady.value).toBe(false)
    expect(versionControl.repositoryNeedsInitialization.value).toBe(false)
    expect(versionControl.timelinePlaceholder.value).toBe('sidebar.timelineNoFile')

    projectPath.value = PROJECT_ROOT
    activeSession.value = workspaceSession()
    await vi.waitFor(() => expect(versionControl.repositoryReady.value).toBe(true))

    expect(versionControl.timelineFilePath.value).toBe(DOCUMENT_PATH)
    expect(versionControl.timelineFileName.value).toBe('main.ocdocument')
    expect(versionControl.repositoryNeedsInitialization.value).toBe(false)
    expect(versionControl.timelinePlaceholder.value).toBe('sidebar.timelineNoCommits')

    mocks.inspectRepository.mockResolvedValue(ok(repository(false)))
    await versionControl.refreshTimeline()

    expect(versionControl.repositoryReady.value).toBe(false)
    expect(versionControl.repositoryNeedsInitialization.value).toBe(true)
    expect(versionControl.timelinePlaceholder.value).toBe('sidebar.timelineNotInitialized')

    mocks.inspectRepository.mockResolvedValue(failure('git unavailable'))
    await versionControl.refreshTimeline()

    expect(versionControl.repositoryReady.value).toBe(false)
    expect(versionControl.repositoryNeedsInitialization.value).toBe(false)
    expect(versionControl.timelinePlaceholder.value).toBe('sidebar.timelineFailed')
  })

  it('keeps version graph expansion in step with the commit graph', async () => {
    mocks.readHistory.mockResolvedValue(ok([commitSummary('a1', [{ path: DOCUMENT_PATH, status: 'modified' }])]))
    const { versionControl, projectPath, activeSession } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    activeSession.value = workspaceSession()
    await vi.waitFor(() => expect(versionControl.timelineProjectTreeData.value.rootKeys).toEqual(['project-timeline:a1']))

    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:a1', expanded: true })
    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:a1', expanded: true })
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:a1'])

    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:b2', expanded: true })
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:a1', 'project-timeline:b2'])

    await versionControl.refreshTimelineStatus()
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:a1', 'project-timeline:b2'])

    mocks.readHistory.mockResolvedValue(ok([commitSummary('b2', [{ path: DOCUMENT_PATH, status: 'modified' }])]))
    await versionControl.refreshTimeline()
    // 重载后 a1 真的不在数据里了：仍然存在的 b2 保留展开，只有消失的 a1 被剪掉。
    await vi.waitFor(() => expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:b2']))

    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:b2', expanded: true })
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:b2'])

    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:b2', expanded: false })
    expect(versionControl.versionGraphExpandedKeys.value).toEqual([])

    versionControl.handleVersionGraphExpansionSync({ expandedKeys: ['project-timeline:c3'] })
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:c3'])
  })

  it('keeps expanded version graph nodes when the timeline is refreshed', async () => {
    mocks.readHistory.mockResolvedValue(ok([
      commitSummary('a1', [{ path: DOCUMENT_PATH, status: 'modified' }]),
      commitSummary('b2', [{ path: DOCUMENT_PATH, status: 'modified' }]),
    ]))
    const { versionControl, projectPath, activeSession } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    activeSession.value = workspaceSession()
    await vi.waitFor(() => expect(versionControl.timelineProjectTreeData.value.rootKeys).toEqual([
      'project-timeline:a1',
      'project-timeline:b2',
    ]))

    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:a1', expanded: true })
    versionControl.handleVersionGraphExpansionChange({ key: 'project-timeline:b2', expanded: true })
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:a1', 'project-timeline:b2'])

    await versionControl.refreshTimeline()
    await nextTick()

    expect(versionControl.timelineProjectTreeData.value.rootKeys).toEqual([
      'project-timeline:a1',
      'project-timeline:b2',
    ])
    expect(versionControl.versionGraphExpandedKeys.value).toEqual(['project-timeline:a1', 'project-timeline:b2'])
  })

  it('keeps the commit dialog open while a commit runs and closes it on success', async () => {
    const { versionControl, projectPath } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    versionControl.commitVersionDialogOpen.value = true
    versionControl.commitVersionError.value = 'stale error'

    let releaseStage: ((value: unknown) => void) | undefined
    mocks.stageAll.mockImplementationOnce(() => new Promise(resolve => { releaseStage = resolve }))

    const pending = versionControl.commitVersion({ summary: 'Publish', description: 'Details' })
    expect(versionControl.isCommittingVersion.value).toBe(true)
    expect(versionControl.commitVersionError.value).toBe('')

    versionControl.closeCommitVersionDialog()
    expect(versionControl.commitVersionDialogOpen.value).toBe(true)

    releaseStage?.(ok(true))
    await pending

    expect(versionControl.isCommittingVersion.value).toBe(false)
    expect(versionControl.commitVersionDialogOpen.value).toBe(false)
    expect(mocks.createCommit).toHaveBeenCalledWith(PROJECT_ROOT, { message: 'Publish\n\nDetails' })
  })

  it('reports a failed commit without closing the dialog', async () => {
    const { versionControl, projectPath } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    versionControl.commitVersionDialogOpen.value = true
    mocks.stageAll.mockResolvedValue(failure('nothing staged'))

    await versionControl.commitVersion({ summary: 'Publish', description: '' })

    expect(versionControl.commitVersionError.value).toBe('nothing staged')
    expect(versionControl.commitVersionDialogOpen.value).toBe(true)
    expect(versionControl.isCommittingVersion.value).toBe(false)
    expect(mocks.createCommit).not.toHaveBeenCalled()
  })

  it('keeps the initialize dialog open while initialization runs and closes it on success', async () => {
    const { versionControl, projectPath } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    versionControl.initializeRepositoryDialogOpen.value = true

    let releaseInitialize: ((value: unknown) => void) | undefined
    mocks.initializeRepository.mockImplementationOnce(() => new Promise(resolve => { releaseInitialize = resolve }))

    const pending = versionControl.initializeProjectRepository({ identity: IDENTITY, createInitialCommit: false })
    expect(versionControl.isInitializingRepository.value).toBe(true)

    versionControl.closeInitializeRepositoryDialog()
    expect(versionControl.initializeRepositoryDialogOpen.value).toBe(true)

    releaseInitialize?.(ok(true))
    await pending

    expect(versionControl.isInitializingRepository.value).toBe(false)
    expect(versionControl.initializeRepositoryDialogOpen.value).toBe(false)
    expect(versionControl.repositoryInitializedDuringDialog.value).toBe(false)
    expect(mocks.createCommit).not.toHaveBeenCalled()
  })

  it('reports an initial commit failure as such once the repository was initialized', async () => {
    const { versionControl, projectPath } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    versionControl.initializeRepositoryDialogOpen.value = true
    mocks.stageAll.mockRejectedValueOnce('initial commit exploded')

    await versionControl.initializeProjectRepository({ identity: IDENTITY, createInitialCommit: true })

    expect(versionControl.initializeRepositoryError.value).toBe('sidebar.initializeDialog.initialCommitFailed')
    expect(versionControl.initializeRepositoryDialogOpen.value).toBe(true)
    expect(versionControl.isInitializingRepository.value).toBe(false)
  })

  it('reports a plain initialization failure when the repository was never created', async () => {
    const { versionControl, projectPath } = createVersionControl()
    projectPath.value = PROJECT_ROOT
    versionControl.initializeRepositoryDialogOpen.value = true
    mocks.initializeRepository.mockRejectedValueOnce('initialization exploded')

    await versionControl.initializeProjectRepository({ identity: IDENTITY, createInitialCommit: true })

    expect(versionControl.initializeRepositoryError.value).toBe('sidebar.initializeDialog.failed')
    expect(versionControl.initializeRepositoryDialogOpen.value).toBe(true)
  })

  it('refreshes repository status for a file change only while a project is open', async () => {
    const { versionControl, projectPath, fileChangeRevision } = createVersionControl()

    await versionControl.refreshTimelineStatus()
    expect(mocks.readStatus).not.toHaveBeenCalled()

    projectPath.value = PROJECT_ROOT
    await vi.waitFor(() => expect(versionControl.repositoryReady.value).toBe(true))
    mocks.readStatus.mockClear()

    fileChangeRevision.value += 1
    await vi.waitFor(() => expect(mocks.readStatus).toHaveBeenCalledWith(PROJECT_ROOT))
  })
})
