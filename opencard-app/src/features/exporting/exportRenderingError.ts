import type { CardPipelineIssue } from '../card-rendering/cardPipelineIssue'

export class ExportRenderDiagnosticsError extends Error {
  readonly issues: readonly CardPipelineIssue[]

  constructor(issues: readonly CardPipelineIssue[]) {
    super(`Rendering reported ${issues.length} runtime issue${issues.length === 1 ? '' : 's'}`)
    this.name = 'ExportRenderDiagnosticsError'
    this.issues = issues
  }
}
