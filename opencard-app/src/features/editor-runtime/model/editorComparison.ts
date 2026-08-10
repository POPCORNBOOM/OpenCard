export type EditorAccess = 'edit' | 'observe-only'

export type CardComparisonLayout = 'horizontal' | 'vertical' | 'historical' | 'current'
export type CardComparisonRole = 'historical' | 'current'

export type TextEditorComparison = {
  historicalContent: string
  currentContent: string
  historicalLabel: string
  currentLabel: string
}
