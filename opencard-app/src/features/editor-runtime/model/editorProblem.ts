export type EditorProblemSource = 'binding' | 'render-parser'

export type EditorProblemSeverity = 'error' | 'warning' | 'info'

export interface EditorProblem {
  id: string
  source: EditorProblemSource
  severity: EditorProblemSeverity
  message: string
  code?: string
  detail?: string
  path?: string
  token?: string
  blockId?: string
  fieldKey?: string
}
