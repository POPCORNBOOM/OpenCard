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
