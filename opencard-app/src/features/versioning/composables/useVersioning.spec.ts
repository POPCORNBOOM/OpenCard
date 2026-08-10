import { ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VersioningService } from '../services/versioningService'
import type { EditorSession } from '../../workspace/store/editorSessionStore'
import { useVersioning } from './useVersioning'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useVersioning project preparation', () => {
  it('opens and releases a comparison without replacing the source session', async () => {
    const projectPath = ref('D:/project')
    const sourceSession: EditorSession = {
      id: 'session-1',
      resourceKind: 'workspace',
      path: 'D:/project/cards/main.json',
      fileTypeId: 'json',
      name: 'main.json',
      editorId: 'monaco',
      savedContent: '{"value":2}',
      draftContent: '{"value":3}',
      contentRevision: 1,
      isDirty: true,
      isPreview: false,
    }
    const service: VersioningService = {
      prepareProject: vi.fn(async request => ({
        identity: { projectId: 'project-id', canonicalRoot: request.projectRoot, generation: request.generation },
      })),
      getStatus: vi.fn(async request => ({
        identity: { projectId: request.projectId, canonicalRoot: request.projectRoot, generation: request.generation },
        current: null,
        nextVersion: '0.0.1',
        expectedHeadCommitId: null,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot' },
        hasManagedContent: true,
      })),
      listVersions: vi.fn(async request => ({ projectId: request.projectId, items: [], nextCursor: null })),
      createVersion: vi.fn(),
      listFileHistory: vi.fn(),
      previewChanges: vi.fn(),
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(),
      findLocalHistoryFiles: vi.fn(),
      moveLocalHistory: vi.fn(),
      prepareCompare: vi.fn(async request => ({
        projectId: request.projectId,
        generation: request.generation,
        leaseId: 'a'.repeat(40),
        historical: {
          rootPath: 'D:/history', relativePath: request.relativePath, completeness: 'project' as const, exists: true,
        },
        current: {
          rootPath: 'D:/current', relativePath: request.relativePath, completeness: 'project' as const, exists: true,
        },
      })),
      releaseCompare: vi.fn(async () => ({ released: true })),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(async request => ({
        projectId: request.projectId,
        expectedHeadCommitId: 'head-1',
        expectedSnapshotId: 'snapshot-1',
        currentChanges: { added: 1, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot-1' },
        restoreChanges: { added: 0, modified: 2, deleted: 1, files: [], snapshotId: 'snapshot-1' },
      })),
      restoreProject: vi.fn(),
      restoreLocalHistory: vi.fn(),
    }
    const sessions = ref<EditorSession[]>([sourceSession])
    const versioning = useVersioning({
      projectPath,
      sessions,
      service,
      flushAffectedSessions: vi.fn(async () => undefined),
      prepareSessionContent: vi.fn(() => null),
      saveSession: vi.fn(async () => ({ status: 'skipped' as const, sessionId: '', reason: 'missing' as const })),
    })
    await vi.waitFor(() => expect(versioning.readiness.value.status).toBe('ready'))

    await expect(versioning.previewRestore('commit-1')).resolves.toMatchObject({
      expectedHeadCommitId: 'head-1',
      restoreChanges: { modified: 2, deleted: 1 },
    })
    expect(service.previewRestore).toHaveBeenCalledWith(expect.objectContaining({
      targetCommitId: 'commit-1',
    }))

    await versioning.openCompare('version', 'commit-1', sourceSession, 'cards/main.json')
    await versioning.openCompare('version', 'commit-1', sourceSession, 'cards/main.json')

    expect(versioning.compareSession.value).toMatchObject({
      sourceSessionId: 'session-1',
      sourcePath: 'D:/project/cards/main.json',
      openedFromHistorySource: 'version',
      openedFromHistoryItemId: 'commit-1',
    })
    expect(service.prepareCompare).toHaveBeenCalledTimes(1)
    expect(sessions.value[0]).toMatchObject({
      id: 'session-1',
      draftContent: '{"value":3}',
      isDirty: true,
    })

    await versioning.closeCompare()
    expect(versioning.compareSession.value).toBeNull()
    expect(service.releaseCompare).toHaveBeenCalledWith(expect.objectContaining({ leaseId: 'a'.repeat(40) }))
    versioning.dispose()
  })

  it('opens a Local History comparison for a missing file without creating an editor session', async () => {
    const projectPath = ref('D:/project')
    const service: VersioningService = {
      prepareProject: vi.fn(async request => ({
        identity: { projectId: 'project-id', canonicalRoot: request.projectRoot, generation: request.generation },
      })),
      getStatus: vi.fn(async request => ({
        identity: { projectId: request.projectId, canonicalRoot: request.projectRoot, generation: request.generation },
        current: null,
        nextVersion: '0.0.1',
        expectedHeadCommitId: null,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot' },
        hasManagedContent: false,
      })),
      listVersions: vi.fn(async request => ({ projectId: request.projectId, items: [], nextCursor: null })),
      createVersion: vi.fn(),
      listFileHistory: vi.fn(),
      previewChanges: vi.fn(),
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(),
      findLocalHistoryFiles: vi.fn(),
      moveLocalHistory: vi.fn(),
      restoreLocalHistory: vi.fn(),
      prepareCompare: vi.fn(async request => ({
        projectId: request.projectId,
        generation: request.generation,
        leaseId: 'b'.repeat(40),
        historical: { rootPath: 'D:/history', relativePath: request.relativePath, completeness: 'single-file' as const, exists: true },
        current: { rootPath: 'D:/current', relativePath: request.relativePath, completeness: 'project' as const, exists: false },
      })),
      releaseCompare: vi.fn(async () => ({ released: true })),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(),
      restoreProject: vi.fn(),
    }
    const sessions = ref<EditorSession[]>([])
    const versioning = useVersioning({
      projectPath,
      sessions,
      service,
      flushAffectedSessions: vi.fn(async () => undefined),
      prepareSessionContent: vi.fn(() => null),
      saveSession: vi.fn(async () => ({ status: 'skipped' as const, sessionId: '', reason: 'missing' as const })),
    })
    await vi.waitFor(() => expect(versioning.readiness.value.status).toBe('ready'))

    await versioning.openDetachedLocalHistoryCompare(
      'entry-1',
      'notes/deleted.md',
      'D:/project/notes/deleted.md',
      'monaco',
    )

    expect(sessions.value).toEqual([])
    expect(versioning.compareSession.value).toMatchObject({
      sourceSessionId: null,
      sourcePath: 'D:/project/notes/deleted.md',
      editorId: 'monaco',
      openedFromHistorySource: 'local-history',
      openedFromHistoryItemId: 'entry-1',
      current: { exists: false },
    })
    versioning.dispose()
  })

  it('retains visible file history when refresh fails and reloads after deleting a local record', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const projectPath = ref('D:/project')
    const savedVersion = {
      commitId: 'commit-1',
      parentCommitId: null,
      previousVersion: null,
      version: '0.0.1',
      kind: 'saved' as const,
      description: 'Initial card',
      savedAtUnixMs: 1,
      restoredFrom: null,
      release: null,
      changes: { added: 1, modified: 0, deleted: 0 },
    }
    const localEntry = {
      schemaVersion: 1,
      entryId: 'local-1',
      relativePath: 'cards/main.json',
      createdAtUnixMs: 2,
      source: 'manual-save' as const,
      sourceDescription: null,
      contentOid: 'oid-1',
      size: 12,
    }
    let failRefresh = false
    let failVersionRefresh = false
    const nextVersion = {
      ...savedVersion,
      commitId: 'commit-2',
      parentCommitId: savedVersion.commitId,
      previousVersion: savedVersion.version,
      version: '0.0.2',
      description: 'Second card',
    }
    const service: VersioningService = {
      prepareProject: vi.fn(async request => ({
        identity: { projectId: 'project-id', canonicalRoot: request.projectRoot, generation: request.generation },
      })),
      getStatus: vi.fn(async request => ({
        identity: { projectId: request.projectId, canonicalRoot: request.projectRoot, generation: request.generation },
        current: savedVersion,
        nextVersion: '0.0.2',
        expectedHeadCommitId: savedVersion.commitId,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot' },
        hasManagedContent: true,
      })),
      listVersions: vi.fn(async request => {
        if (failVersionRefresh && !request.cursor) throw new Error('version refresh failed')
        return request.cursor
          ? { projectId: request.projectId, items: [savedVersion, nextVersion], nextCursor: null }
          : { projectId: request.projectId, items: [savedVersion], nextCursor: 'next' }
      }),
      createVersion: vi.fn(),
      listFileHistory: vi.fn(async request => {
        if (failRefresh) throw new Error('refresh failed')
        return { projectId: request.projectId, relativePath: request.relativePath, items: [savedVersion] }
      }),
      previewChanges: vi.fn(),
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(async request => {
        if (failRefresh) throw new Error('refresh failed')
        return { projectId: request.projectId, relativePath: request.relativePath, items: [localEntry], warnings: [] }
      }),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(async request => ({ projectId: request.projectId, deleted: true, warnings: [] })),
      findLocalHistoryFiles: vi.fn(async request => ({
        projectId: request.projectId,
        items: [{
          relativePath: request.cursor ? 'notes/two.md' : 'notes/one.md',
          latestEntryAtUnixMs: request.cursor ? 2 : 1,
          entryCount: 1,
          currentlyExists: !request.cursor,
        }],
        nextCursor: request.cursor ? null : 'next',
      })),
      moveLocalHistory: vi.fn(async request => ({
        projectId: request.projectId,
        movedFiles: 1,
        recordedFiles: 1,
        warnings: [],
      })),
      restoreLocalHistory: vi.fn(),
      prepareCompare: vi.fn(),
      releaseCompare: vi.fn(),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(),
      restoreProject: vi.fn(),
    }
    const versioning = useVersioning({
      projectPath,
      sessions: ref([]),
      service,
      flushAffectedSessions: vi.fn(async () => undefined),
      prepareSessionContent: vi.fn(() => null),
      saveSession: vi.fn(async () => ({ status: 'skipped' as const, sessionId: '', reason: 'missing' as const })),
    })
    await vi.waitFor(() => expect(versioning.readiness.value.status).toBe('ready'))
    expect(versioning.versions.value).toEqual([savedVersion])
    expect(versioning.nextVersionCursor.value).toBe('next')

    failVersionRefresh = true
    await versioning.refreshVersions()
    expect(versioning.versions.value).toEqual([savedVersion])
    expect(versioning.versionsError.value).toEqual(expect.any(Error))

    failVersionRefresh = false
    await versioning.loadMoreVersions()
    expect(versioning.versions.value).toEqual([savedVersion, nextVersion])
    expect(versioning.nextVersionCursor.value).toBeNull()

    await versioning.loadFileHistory('cards/main.json')

    expect(versioning.fileVersions.value).toEqual([savedVersion])
    expect(versioning.localHistory.value).toEqual([localEntry])

    failRefresh = true
    await versioning.loadFileHistory('cards/main.json')

    expect(versioning.fileVersions.value).toEqual([savedVersion])
    expect(versioning.localHistory.value).toEqual([localEntry])

    failRefresh = false
    await versioning.deleteLocalHistory('cards/main.json', 'local-1')

    expect(service.deleteLocalHistory).toHaveBeenCalledWith(expect.objectContaining({
      relativePath: 'cards/main.json',
      entryId: 'local-1',
    }))
    expect(service.listFileHistory).toHaveBeenCalledTimes(3)

    await versioning.findLocalHistoryFiles('notes')
    await versioning.findLocalHistoryFiles('notes', versioning.nextLocalHistoryFilesCursor.value)

    expect(versioning.localHistoryFiles.value.map(item => item.relativePath)).toEqual([
      'notes/one.md',
      'notes/two.md',
    ])
    expect(versioning.nextLocalHistoryFilesCursor.value).toBeNull()
    await versioning.moveLocalHistory('notes/one.md', 'archive/one.md', 'file-renamed')
    expect(service.moveLocalHistory).toHaveBeenCalledWith(expect.objectContaining({
      fromRelativePath: 'notes/one.md',
      toRelativePath: 'archive/one.md',
      source: 'file-renamed',
    }))
    versioning.dispose()
  })

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
      listFileHistory: vi.fn(),
      previewChanges: vi.fn(async request => ({
        projectId: request.projectId,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: 'snapshot' },
        overlayRevisions: request.overlays,
      })),
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(),
      findLocalHistoryFiles: vi.fn(),
      moveLocalHistory: vi.fn(),
      prepareCompare: vi.fn(),
      releaseCompare: vi.fn(),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(),
      restoreProject: vi.fn(),
      restoreLocalHistory: vi.fn(),
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
      listFileHistory: vi.fn(),
      previewChanges: vi.fn(async request => ({
        projectId: request.projectId,
        changeSummary: { added: 0, modified: 0, deleted: 0, files: [], snapshotId: request.projectId },
        overlayRevisions: request.overlays,
      })),
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(),
      findLocalHistoryFiles: vi.fn(),
      moveLocalHistory: vi.fn(),
      prepareCompare: vi.fn(),
      releaseCompare: vi.fn(),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(),
      restoreProject: vi.fn(),
      restoreLocalHistory: vi.fn(),
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
      listFileHistory: vi.fn(),
      previewChanges: vi.fn(),
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(),
      findLocalHistoryFiles: vi.fn(),
      moveLocalHistory: vi.fn(),
      prepareCompare: vi.fn(),
      releaseCompare: vi.fn(),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(),
      restoreProject: vi.fn(),
      restoreLocalHistory: vi.fn(),
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
      previousVersion: null,
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
      recordLocalHistory: vi.fn(),
      listLocalHistory: vi.fn(),
      readLocalHistory: vi.fn(),
      deleteLocalHistory: vi.fn(),
      findLocalHistoryFiles: vi.fn(),
      moveLocalHistory: vi.fn(),
      prepareCompare: vi.fn(),
      releaseCompare: vi.fn(),
      publishVersion: vi.fn(),
      editReleaseDescription: vi.fn(),
      previewRestore: vi.fn(),
      restoreProject: vi.fn(),
      restoreLocalHistory: vi.fn(),
      createVersion: vi.fn(async request => ({
        version: { ...savedVersion, version: request.requestedVersion ?? savedVersion.version },
        changeSummary,
      })),
      listVersions: vi.fn(async request => ({
        projectId: request.projectId,
        items: [],
        nextCursor: null,
      })),
      listFileHistory: vi.fn(),
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
      source: 'save-version' as const,
      path: 'D:/project/cards/main.ocdocument',
      relativePath: 'cards/main.ocdocument',
      startedRevision: 3,
      persistedRevision: 3,
      currentRevision: 3,
      persistedContent: '{"name":"new"}',
      sessionStillDirty: false,
      localHistory: 'recorded' as const,
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

    expect(saveSession).toHaveBeenCalledWith('session-1', undefined, 'save-version')
    expect(service.createVersion).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-id',
      expectedSnapshotId: 'preview-snapshot',
      description: 'Update card package',
    }))
    expect(versioning.writeState.value).toEqual({ status: 'idle' })

    await versioning.openSaveVersion(true)
    expect(versioning.saveVersionConfirmation.value?.publish).toBe(true)
    await versioning.confirmSaveVersion('Release card package', '1.0.0')

    expect(saveSession).toHaveBeenLastCalledWith('session-1', undefined, 'save-and-publish')
    expect(service.publishVersion).toHaveBeenCalledWith(expect.objectContaining({
      commitId: savedVersion.commitId,
      version: '1.0.0',
      description: 'Release card package',
    }))
    versioning.dispose()
  })
})
