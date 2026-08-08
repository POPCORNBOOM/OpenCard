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

export type LocalHistorySource =
  | 'manual-save'
  | 'close-guard-save'
  | 'save-version'
  | 'save-and-publish'
  | 'file-restored'
  | 'file-renamed'
  | 'file-moved'

export type LocalHistoryEntryDto = {
  schemaVersion: number
  entryId: string
  relativePath: string
  createdAtUnixMs: number
  source: LocalHistorySource
  sourceDescription: string | null
  contentOid: string
  size: number
}

export type LocalHistoryRecordRequest = VersionProjectRequest & {
  relativePath: string
  source: LocalHistorySource
  sourceDescription?: string
  content: number[]
}

export type LocalHistoryRecordResponse = {
  projectId: string
  entry: LocalHistoryEntryDto
  result: 'recorded' | 'merged' | 'unchanged'
  warnings: Array<{ code: string; entryId: string | null }>
}

export type LocalHistoryPathRequest = VersionProjectRequest & {
  relativePath: string
}

export type LocalHistoryListResponse = {
  projectId: string
  relativePath: string
  items: LocalHistoryEntryDto[]
  warnings: Array<{ code: string; entryId: string | null }>
}

export type LocalHistoryEntryRequest = LocalHistoryPathRequest & {
  entryId: string
}

export type LocalHistoryReadResponse = {
  projectId: string
  entry: LocalHistoryEntryDto
  content: number[]
}

export type LocalHistoryDeleteResponse = {
  projectId: string
  deleted: boolean
  warnings: Array<{ code: string; entryId: string | null }>
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

export type FileHistoryRequest = VersionProjectRequest & {
  relativePath: string
}

export type FileHistoryResponse = {
  projectId: string
  relativePath: string
  items: VersionRecordDto[]
}

export type CompareSourceRequest =
  | { kind: 'version'; commitId: string }
  | { kind: 'local-history'; entryId: string }

export type SnapshotDescriptorDto = {
  rootPath: string
  relativePath: string
  completeness: 'project' | 'single-file'
  exists: boolean
}

export type PrepareCompareRequest = VersionProjectRequest & {
  relativePath: string
  source: CompareSourceRequest
}

export type PrepareCompareResponse = {
  projectId: string
  generation: number
  leaseId: string
  historical: SnapshotDescriptorDto
  current: SnapshotDescriptorDto
}

export type ReleaseCompareRequest = VersionProjectRequest & {
  leaseId: string
}

export type ReleaseCompareResponse = {
  released: boolean
}

export type CompareSession = PrepareCompareResponse & {
  id: string
  projectRoot: string
  sourceSessionId: string
  sourcePath: string
  editorId: string
  openedFromHistoryItemId: string
}

export type VersionWriteState =
  | { status: 'idle' }
  | { status: 'preparing'; operation: 'save' }
  | { status: 'confirming'; operation: 'save' }
  | { status: 'running'; operation: 'save'; operationId: string }

export type VersioningError = VersionErrorDto

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
  projectRoot: string
  projectId: string
  generation: number
  version: string
  expectedHeadCommitId: string | null
  expectedSnapshotId: string
  changeSummary: ChangeSummaryDto
  sessionRevisions: Array<Pick<DraftOverlayDto, 'sessionId' | 'relativePath' | 'contentRevision'>>
}
