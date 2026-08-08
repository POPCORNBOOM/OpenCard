import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VersioningService } from '../services/versioningService'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { useVersioning } from './useVersioning'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useVersioning project preparation', () => {
  it('prepares the active project without blocking its lifecycle', async () => {
    const projectPath = ref('D:/project')
    const service: VersioningService = {
      prepareProject: vi.fn(async request => ({
        identity: {
          projectId: 'project-id',
          canonicalRoot: request.projectRoot,
          generation: request.generation,
        },
      })),
      getStatus: vi.fn(async request => ({
        identity: {
          projectId: request.projectId,
          canonicalRoot: request.projectRoot,
          generation: request.generation,
        },
        current: null,
        nextVersion: '0.0.1',
        expectedHeadCommitId: null,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot' },
        hasManagedContent: false,
      })),
      createVersion: vi.fn(),
      listVersions: vi.fn(async request => ({
        projectId: request.projectId,
        items: [],
        nextCursor: null,
      })),
      previewChanges: vi.fn(async request => ({
        projectId: request.projectId,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot' },
        overlayRevisions: request.overlays,
      })),
    }
    const versioning = useVersioning({
      projectPath,
      service,
      sessions: ref([]),
      flushAffectedSessions: vi.fn(async () => undefined),
      prepareSessionContent: vi.fn(() => null),
      saveSession: vi.fn(async () => ({ status: 'skipped' as const, sessionId: '', reason: 'missing' as const })),
    })

    expect(versioning.readiness.value.status).toBe('preparing')
    await vi.waitFor(() => expect(versioning.readiness.value).toEqual({
      status: 'ready',
      projectId: 'project-id',
    }))
    versioning.dispose()
  })

  it('drops a stale preparation response after the project changes', async () => {
    let finishFirst: ((projectId: string) => void) | undefined
    const projectPath = ref('D:/first')
    const service: VersioningService = {
      prepareProject: vi.fn(async request => {
        if (request.projectRoot === 'D:/first') {
          const projectId = await new Promise<string>(resolve => { finishFirst = resolve })
          return { identity: { projectId, canonicalRoot: request.projectRoot, generation: request.generation } }
        }
        return {
          identity: {
            projectId: 'second-id',
            canonicalRoot: request.projectRoot,
            generation: request.generation,
          },
        }
      }),
      getStatus: vi.fn(async request => ({
        identity: {
          projectId: request.projectId,
          canonicalRoot: request.projectRoot,
          generation: request.generation,
        },
        current: null,
        nextVersion: '0.0.1',
        expectedHeadCommitId: null,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: request.projectId },
        hasManagedContent: false,
      })),
      createVersion: vi.fn(),
      listVersions: vi.fn(async request => ({
        projectId: request.projectId,
        items: [],
        nextCursor: null,
      })),
      previewChanges: vi.fn(async request => ({
        projectId: request.projectId,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: request.projectId },
        overlayRevisions: request.overlays,
      })),
    }
    const versioning = useVersioning({
      projectPath,
      service,
      sessions: ref([]),
      flushAffectedSessions: vi.fn(async () => undefined),
      prepareSessionContent: vi.fn(() => null),
      saveSession: vi.fn(async () => ({ status: 'skipped' as const, sessionId: '', reason: 'missing' as const })),
    })
    projectPath.value = 'D:/second'
    await vi.waitFor(() => expect(versioning.readiness.value).toEqual({
      status: 'ready',
      projectId: 'second-id',
    }))
    finishFirst?.('first-id')
    await Promise.resolve()

    expect(versioning.identity.value?.projectId).toBe('second-id')
    versioning.dispose()
  })

  it('degrades only versioning when native history is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const projectPath = ref('D:/project')
    const service: VersioningService = {
      prepareProject: vi.fn(async () => {
        throw { code: 'history-corrupt', projectId: 'project-id' }
      }),
      getStatus: vi.fn(),
      createVersion: vi.fn(),
      listVersions: vi.fn(),
      previewChanges: vi.fn(),
    }
    const versioning = useVersioning({
      projectPath,
      service,
      sessions: ref([]),
      flushAffectedSessions: vi.fn(async () => undefined),
      prepareSessionContent: vi.fn(() => null),
      saveSession: vi.fn(async () => ({ status: 'skipped' as const, sessionId: '', reason: 'missing' as const })),
    })

    await vi.waitFor(() => expect(versioning.readiness.value).toEqual({
      status: 'degraded',
      projectId: 'project-id',
      reason: 'corrupt',
    }))
    versioning.dispose()
  })

  it('previews dirty sessions before saving them into one version', async () => {
    const projectPath = ref('D:/project')
    const sessions = ref<EditorSession[]>([{
      id: 'session-1',
      resourceKind: 'workspace',
      path: 'D:/project/cards/main.ocdocument',
      fileTypeId: 'opencard',
      name: 'main.ocdocument',
      editorId: 'card-designer',
      savedContent: '{"name":"old"}',
      draftContent: '{"name":"new"}',
      contentRevision: 3,
      isDirty: true,
      isPreview: false,
    }])
    const changeSummary = {
      added: 0,
      modified: 1,
      deleted: 0,
      files: [{ path: 'cards/main.ocdocument', status: 'modified' as const }],
      snapshotId: 'preview-snapshot',
    }
    const savedVersion = {
      commitId: 'commit-1',
      parentCommitId: null,
      version: '0.0.1',
      kind: 'saved' as const,
      description: 'Update card package',
      savedAtUnixMs: 1,
      restoredFrom: null,
      release: null,
      changes: { added: 0, modified: 1, deleted: 0 },
    }
    const service: VersioningService = {
      prepareProject: vi.fn(async request => ({
        identity: {
          projectId: 'project-id',
          canonicalRoot: request.projectRoot,
          generation: request.generation,
        },
      })),
      getStatus: vi.fn(async request => ({
        identity: {
          projectId: request.projectId,
          canonicalRoot: request.projectRoot,
          generation: request.generation,
        },
        current: null,
        nextVersion: '0.0.1',
        expectedHeadCommitId: null,
        changeSummary,
        hasManagedContent: true,
      })),
      previewChanges: vi.fn(async request => ({
        projectId: request.projectId,
        changeSummary,
        overlayRevisions: request.overlays,
      })),
      createVersion: vi.fn(async () => ({ version: savedVersion, changeSummary })),
      listVersions: vi.fn(async request => ({
        projectId: request.projectId,
        items: [],
        nextCursor: null,
      })),
    }
    const flushAffectedSessions = vi.fn(async () => undefined)
    const prepareSessionContent = vi.fn(() => ({
      sessionId: 'session-1',
      relativePath: 'cards/main.ocdocument',
      content: '{"name":"new"}',
      contentRevision: 3,
    }))
    const saveSession = vi.fn(async () => ({
      status: 'saved' as const,
      sessionId: 'session-1',
      resourceKind: 'workspace' as const,
      path: 'D:/project/cards/main.ocdocument',
      relativePath: 'cards/main.ocdocument',
      startedRevision: 3,
      persistedRevision: 3,
      currentRevision: 3,
      persistedContent: '{"name":"new"}',
      sessionStillDirty: false,
    }))
    const versioning = useVersioning({
      projectPath,
      sessions,
      service,
      flushAffectedSessions,
      prepareSessionContent,
      saveSession,
    })
    await vi.waitFor(() => expect(versioning.readiness.value.status).toBe('ready'))

    await versioning.openSaveVersion()

    expect(flushAffectedSessions).toHaveBeenCalledWith(['session-1'])
    expect(service.previewChanges).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-id',
      overlays: [expect.objectContaining({ sessionId: 'session-1', contentRevision: 3 })],
    }))
    expect(versioning.saveVersionConfirmation.value?.expectedSnapshotId).toBe('preview-snapshot')

    await versioning.confirmSaveVersion('Update card package')

    expect(saveSession).toHaveBeenCalledWith('session-1')
    expect(service.createVersion).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-id',
      expectedSnapshotId: 'preview-snapshot',
      description: 'Update card package',
    }))
    expect(versioning.writeState.value).toEqual({ status: 'idle' })
    versioning.dispose()
  })
})
