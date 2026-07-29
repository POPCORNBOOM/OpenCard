import type { IconToken } from '../icon/iconRegistry'

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

export type PropertyFieldConstraintMap = {
  string: {
    minLength?: number
    maxLength?: number
    options?: readonly string[]
    multiline?: boolean
    richText?: boolean
  }
  filePath: {
    minLength?: number
    maxLength?: number
  }
  anchorPosition: Record<never, never>
  alignPosition: Record<never, never>
  verticalAlignPosition: Record<never, never>
  flowDirection: Record<never, never>
  number: {
    min?: number
    max?: number
  }
  boolean: Record<never, never>
  color: Record<never, never>
  object: {
    isArray?: boolean
  }
}

export type BasePropertyFieldType = keyof PropertyFieldConstraintMap
export type PropertyArrayElementType = Extract<
  BasePropertyFieldType,
  'string' | 'filePath' | 'number' | 'boolean' | 'color'
>
export type PropertyArrayFieldType = `${PropertyArrayElementType}[]`
export type PropertyFieldType = BasePropertyFieldType | PropertyArrayFieldType

type PropertyEditorFieldBase = {
  title: string
  category?: string
  defaultValue?: unknown
  required?: boolean
  isHidden?: boolean
  isReadonly?: boolean
  resettable?: boolean
  deletable?: boolean
  autoPairs?: readonly PropertyInputPair[]
  completion?: PropertyCompletion
  fontOptions?: readonly {
    label: string
    value: string
    cssFamily?: string
  }[]
  richTextBaseStyle?: {
    fontFamily?: string
    fontSize?: string
  }
  binding?: {
    provider?: PropertyCompletionProvider
  }
}

type ScalarPropertyEditorFieldDefinition = {
  [K in BasePropertyFieldType]: PropertyEditorFieldBase & {
    fieldType: K
  } & PropertyFieldConstraintMap[K]
}[BasePropertyFieldType]

type ArrayPropertyEditorFieldDefinition = {
  [K in PropertyArrayElementType]: PropertyEditorFieldBase & {
    fieldType: `${K}[]`
  } & PropertyFieldConstraintMap[K]
}[PropertyArrayElementType]

export type PropertyEditorFieldDefinition =
  | ScalarPropertyEditorFieldDefinition
  | ArrayPropertyEditorFieldDefinition

export function isArrayPropertyFieldType(fieldType: PropertyFieldType): fieldType is PropertyArrayFieldType {
  return fieldType.endsWith('[]') && !fieldType.slice(0, -2).endsWith('[]')
}

export function getArrayElementFieldType(fieldType: PropertyArrayFieldType): PropertyArrayElementType {
  return fieldType.slice(0, -2) as PropertyArrayElementType
}

export type PropertyEditorBindingInterpreter = {
  isExpression(value: unknown): boolean
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
