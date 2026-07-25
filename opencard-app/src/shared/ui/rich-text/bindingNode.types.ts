import type { IconToken } from '../icon/iconRegistry'

export type RichTextBindingCompletionItem = {
  key: string
  label: string
  detail?: string
  icon?: IconToken
  insertText: string
  keepOpen?: boolean
}

export type RichTextBindingCompletionResult = {
  replaceStart: number
  replaceEnd: number
  items: readonly RichTextBindingCompletionItem[]
}

export type RichTextBindingCompletionProvider = (request: {
  value: string
  cursor: number
}) => RichTextBindingCompletionResult | null | Promise<RichTextBindingCompletionResult | null>
