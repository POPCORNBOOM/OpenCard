export type ProjectIdentityDto = {
  projectId: string
  canonicalRoot: string
  generation: number
}

export type VersionReadiness =
  | { status: 'not-prepared' }
  | { status: 'preparing'; projectId: string }
  | { status: 'ready'; projectId: string }
  | {
    status: 'degraded'
    projectId: string
    reason: 'io' | 'corrupt' | 'incompatible' | 'boundary'
  }

export type VersionErrorDto = {
  code: string
  operation: string
  phase: string
  projectId?: string
  relativePath?: string
  retryable: boolean
  diagnosticId: string
}

export type PrepareProjectRequest = {
  operationId: string
  projectRoot: string
  generation: number
  templateManagedPaths?: string[]
}

export type PrepareProjectResponse = {
  identity: ProjectIdentityDto
}

export type ChangeStatus = 'added' | 'modified' | 'deleted'

export type FileChangeDto = {
  path: string
  status: ChangeStatus
}

export type ChangeSummaryDto = {
  added: number
  modified: number
  deleted: number
  files: FileChangeDto[]
  snapshotId: string
}

export type ReleaseDto = {
  publishedAtUnixMs: number
  description: string
}

export type VersionRecordDto = {
  commitId: string
  parentCommitId: string | null
  version: string
  kind: 'saved' | 'restored'
  description: string
  savedAtUnixMs: number
  restoredFrom: string | null
  release: ReleaseDto | null
  changes: Pick<ChangeSummaryDto, 'added' | 'modified' | 'deleted'>
}

export type VersionStatusDto = {
  identity: ProjectIdentityDto
  current: VersionRecordDto | null
  nextVersion: string
  expectedHeadCommitId: string | null
  changeSummary: ChangeSummaryDto
  hasManagedContent: boolean
}

export type VersionProjectRequest = {
  operationId: string
  projectRoot: string
  projectId: string
  generation: number
}

export type CreateVersionRequest = VersionProjectRequest & {
  expectedHeadCommitId: string | null
  expectedSnapshotId: string
  description: string
}

export type CreateVersionResponse = {
  version: VersionRecordDto
  changeSummary: ChangeSummaryDto
}

export type ListVersionsRequest = VersionProjectRequest & {
  cursor?: string | null
  limit?: number
}

export type VersionListResponse = {
  projectId: string
  items: VersionRecordDto[]
  nextCursor: string | null
}

export type VersionWriteState =
  | { status: 'idle' }
  | { status: 'preparing'; operation: 'save' }
  | { status: 'confirming'; operation: 'save' }
  | { status: 'running'; operation: 'save'; operationId: string }

export type DraftOverlayDto = {
  sessionId: string
  relativePath: string
  content: string
  contentRevision: number
}

export type PreviewChangesRequest = VersionProjectRequest & {
  overlays: DraftOverlayDto[]
}

export type PreviewChangesResponse = {
  projectId: string
  changeSummary: ChangeSummaryDto
  overlayRevisions: Array<Pick<DraftOverlayDto, 'sessionId' | 'relativePath' | 'contentRevision'>>
}

export type SaveVersionConfirmation = {
  version: string
  expectedHeadCommitId: string | null
  expectedSnapshotId: string
  changeSummary: ChangeSummaryDto
  sessionRevisions: Array<Pick<DraftOverlayDto, 'sessionId' | 'relativePath' | 'contentRevision'>>
}
