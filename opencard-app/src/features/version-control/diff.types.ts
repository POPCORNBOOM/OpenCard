export interface DiffSnapshot {
  commitId: string | null
  label: string
  content: string
}

export interface DiffRevisionOption {
  commitId: string | null
  label: string
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
