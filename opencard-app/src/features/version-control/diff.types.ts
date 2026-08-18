import type { ProjectInformation, ProjectRemoteResourcePolicy } from '../workspace/model/projectMetadata'
import type { ProjectIconCatalog } from '../workspace/services/projectIconCatalog'
import type { CustomBlockRuntimeCatalog } from '../card-rendering/expandCustomBlocks'

export interface DiffSnapshot {
  commitId: string | null
  label: string
  content: string
  resourceRootPath?: string | null
  project?: Readonly<ProjectInformation> | null
  dictionary?: Readonly<Record<string, string>>
  projectIconCatalog?: ProjectIconCatalog
  customBlockCatalog?: CustomBlockRuntimeCatalog
  resolveFontFamily?: (references: string) => string
  remoteResourcePolicy?: ProjectRemoteResourcePolicy
}

export interface DiffRevisionOption {
  commitId: string | null
  label: string
  shortId?: string
  authoredAtSeconds?: number
}

export interface DiffSession {
  id: string
  fileTypeId: string
  path: string
  name: string
  before: DiffSnapshot
  after: DiffSnapshot
}

export interface DiffComparisonSelection {
  beforeCommitId: string | null
  afterCommitId: string | null
}
