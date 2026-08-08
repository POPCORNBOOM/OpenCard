export type EditorAccess = 'edit' | 'observe-only'

export type TextEditorComparison = {
  historicalContent: string
  currentContent: string
  historicalLabel: string
  currentLabel: string
}
