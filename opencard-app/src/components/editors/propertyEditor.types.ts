import type { EditorPropertyDefinition } from '../../entities/card/schema'
import type { IconToken } from '../../shared/ui/icon/iconRegistry'

export type PropertyEditorSortMode = 'category' | 'alphabetical'

export type PropertyInputPair = {
  open: string
  close: string
}

export type PropertyCompletionRequest = {
  value: string
  cursor: number
}

export type PropertyCompletionItem = {
  key: string
  label: string
  detail?: string
  icon?: IconToken
  insertText: string
  value?: unknown
  keepOpen?: boolean
}

export type PropertyCompletionResult = {
  replaceStart: number
  replaceEnd: number
  items: readonly PropertyCompletionItem[]
}

export type PropertyCompletionProvider = (
  request: PropertyCompletionRequest,
) => PropertyCompletionResult | null | Promise<PropertyCompletionResult | null>

export type PropertyCompletion = {
  static?: {
    values: readonly string[]
    presentation?: 'ghost' | 'menu'
  }
  provider?: PropertyCompletionProvider
}

export type PropertyEditorFieldDefinition = EditorPropertyDefinition & {
  title: string
  category?: string
  deletable?: boolean
  autoPairs?: readonly PropertyInputPair[]
  completion?: PropertyCompletion
}

export type PropertyEditorRecord = Readonly<Record<string, unknown>>

export type PropertyEditorInput = {
  key: string
  title?: string
  record: PropertyEditorRecord
  fields: Readonly<Record<string, PropertyEditorFieldDefinition>>
}

export type PropertyEditorCategoryDefinition = {
  title: string
  icon?: IconToken
}

export type PropertyEditorMutation = {
  key: string
  fieldKey: string
  value: unknown
}

export type PropertyEditorFieldIntent = {
  key: string
  fieldKey: string
}
