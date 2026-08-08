import { readonly, ref, watch, type Ref } from 'vue'
import { reportAppError } from '../../logging/appErrorCatalog'
import type {
  EditorSession,
  PreparedSessionContent,
  SessionSaveReceipt,
} from '../../workspace/store/editorSessionStore'
import type {
  ProjectIdentityDto,
  VersionErrorDto,
  VersionReadiness,
  VersionStatusDto,
  VersionRecordDto,
  VersionWriteState,
  SaveVersionConfirmation,
} from '../model/versioning'
import {
  versioningService,
  type VersioningService,
} from '../services/versioningService'

type UseVersioningOptions = {
  projectPath: Readonly<Ref<string>>
  sessions: Readonly<Ref<readonly EditorSession[]>>
  flushAffectedSessions: (sessionIds: readonly string[]) => Promise<void>
  prepareSessionContent: (sessionId: string) => PreparedSessionContent | null
  saveSession: (sessionId: string) => Promise<SessionSaveReceipt>
  service?: VersioningService
}

function resolveDegradedReason(error: unknown): 'io' | 'corrupt' | 'incompatible' | 'boundary' {
  const code = (error as Partial<VersionErrorDto> | null)?.code
  if (code === 'history-corrupt') return 'corrupt'
  if (code === 'history-incompatible' || code === 'identity-mismatch') return 'incompatible'
  if (code === 'project-boundary-violation' || code === 'unsupported-entry') return 'boundary'
  return 'io'
}

export function useVersioning(options: UseVersioningOptions) {
  const service = options.service ?? versioningService
  const readiness = ref<VersionReadiness>({ status: 'not-prepared' })
  const identity = ref<ProjectIdentityDto | null>(null)
  const status = ref<VersionStatusDto | null>(null)
  const versions = ref<VersionRecordDto[]>([])
  const nextVersionCursor = ref<string | null>(null)
  const writeState = ref<VersionWriteState>({ status: 'idle' })
  const saveVersionConfirmation = ref<SaveVersionConfirmation | null>(null)
  let generation = 0

  async function prepare(projectRoot: string): Promise<void> {
    const requestGeneration = ++generation
    identity.value = null
    status.value = null
    versions.value = []
    nextVersionCursor.value = null
    saveVersionConfirmation.value = null
    if (!projectRoot) {
      readiness.value = { status: 'not-prepared' }
      return
    }

    readiness.value = { status: 'preparing', projectId: '' }
    try {
      const response = await service.prepareProject({
        operationId: crypto.randomUUID(),
        projectRoot,
        generation: requestGeneration,
      })
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      identity.value = response.identity
      const projectStatus = await service.getStatus({
        operationId: crypto.randomUUID(),
        projectRoot,
        projectId: response.identity.projectId,
        generation: requestGeneration,
      })
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      status.value = projectStatus
      const page = await service.listVersions({
        operationId: crypto.randomUUID(),
        projectRoot,
        projectId: response.identity.projectId,
        generation: requestGeneration,
        cursor: null,
        limit: 50,
      })
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      versions.value = page.items
      nextVersionCursor.value = page.nextCursor
      readiness.value = { status: 'ready', projectId: response.identity.projectId }
    } catch (error) {
      if (requestGeneration !== generation || options.projectPath.value !== projectRoot) return
      const projectId = (error as Partial<VersionErrorDto> | null)?.projectId ?? ''
      readiness.value = {
        status: 'degraded',
        projectId,
        reason: resolveDegradedReason(error),
      }
      reportAppError('OC-E7001', error)
    }
  }

  async function openSaveVersion(): Promise<void> {
    const projectIdentity = identity.value
    const projectStatus = status.value
    const projectRoot = options.projectPath.value
    if (!projectIdentity || !projectStatus || readiness.value.status !== 'ready') return

    writeState.value = { status: 'preparing', operation: 'save' }
    try {
      const dirtySessionIds = options.sessions.value
        .filter(session => session.resourceKind === 'workspace' && session.isDirty)
        .map(session => session.id)
      await options.flushAffectedSessions(dirtySessionIds)
      const overlays = dirtySessionIds
        .map(options.prepareSessionContent)
        .filter((content): content is PreparedSessionContent => content !== null)
      if (overlays.length !== dirtySessionIds.length) {
        throw new Error('A dirty workspace session cannot be prepared for versioning')
      }
      const preview = await service.previewChanges({
        operationId: crypto.randomUUID(),
        projectRoot,
        projectId: projectIdentity.projectId,
        generation: projectIdentity.generation,
        overlays,
      })
      if (preview.changeSummary.files.length === 0) {
        writeState.value = { status: 'idle' }
        return
      }
      saveVersionConfirmation.value = {
        version: projectStatus.nextVersion,
        expectedHeadCommitId: projectStatus.expectedHeadCommitId,
        expectedSnapshotId: preview.changeSummary.snapshotId,
        changeSummary: preview.changeSummary,
        sessionRevisions: preview.overlayRevisions,
      }
      writeState.value = { status: 'confirming', operation: 'save' }
    } catch (error) {
      reportAppError('OC-E7001', error)
      writeState.value = { status: 'idle' }
    }
  }

  function cancelSaveVersion(): void {
    if (writeState.value.status === 'running') return
    saveVersionConfirmation.value = null
    writeState.value = { status: 'idle' }
  }

  async function confirmSaveVersion(description: string): Promise<void> {
    const confirmation = saveVersionConfirmation.value
    const projectIdentity = identity.value
    const projectRoot = options.projectPath.value
    if (!confirmation || !projectIdentity || writeState.value.status !== 'confirming') return

    const sessionsById = new Map(options.sessions.value.map(session => [session.id, session]))
    const hasDrift = confirmation.sessionRevisions.some(revision => (
      sessionsById.get(revision.sessionId)?.contentRevision !== revision.contentRevision
    ))
    if (hasDrift) {
      await openSaveVersion()
      return
    }

    const operationId = crypto.randomUUID()
    writeState.value = { status: 'running', operation: 'save', operationId }
    try {
      for (const revision of confirmation.sessionRevisions) {
        const receipt = await options.saveSession(revision.sessionId)
        if (receipt.status !== 'saved'
          || receipt.persistedRevision !== revision.contentRevision
          || receipt.sessionStillDirty) {
          throw new Error('A workspace session changed while saving the version')
        }
      }
      await service.createVersion({
        operationId,
        projectRoot,
        projectId: projectIdentity.projectId,
        generation: projectIdentity.generation,
        expectedHeadCommitId: confirmation.expectedHeadCommitId,
        expectedSnapshotId: confirmation.expectedSnapshotId,
        description,
      })
      saveVersionConfirmation.value = null
      await prepare(projectRoot)
    } catch (error) {
      reportAppError('OC-E7001', error)
      writeState.value = { status: 'confirming', operation: 'save' }
      throw error
    }
    writeState.value = { status: 'idle' }
  }

  const stopProjectWatch = watch(
    options.projectPath,
    (projectRoot) => void prepare(projectRoot),
    { immediate: true },
  )

  function dispose(): void {
    generation += 1
    stopProjectWatch()
  }

  return {
    readiness: readonly(readiness),
    identity: readonly(identity),
    status: readonly(status),
    versions: readonly(versions),
    nextVersionCursor: readonly(nextVersionCursor),
    writeState: readonly(writeState),
    saveVersionConfirmation: readonly(saveVersionConfirmation),
    prepare,
    openSaveVersion,
    cancelSaveVersion,
    confirmSaveVersion,
    dispose,
  }
}
