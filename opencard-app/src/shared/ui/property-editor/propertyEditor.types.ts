import type { IconToken } from '../icon/iconRegistry'
import type { FilePathDirectoryProvider, FilePathFilter } from '../../model/filePath'
import type { ProjectIconCatalog } from '../../../features/workspace/services/projectIconCatalog'
import type { DeepReadonly } from 'vue'
import type { ProjectCustomBlockCatalog, ProjectCustomBlockManifestCatalog } from '../../../features/workspace/model/projectCustomBlocks'
import type { OcActionDefinition } from '../../../components/standard/OcActionMenu.vue'
import type { OcItemTailPart } from '../itemViewModel.types'

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
  thumbnailStyle?: Readonly<Record<string, string>>
  thumbnailLabel?: string
  labelStyle?: Readonly<Record<string, string>>
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
    optionLabelKeys?: Readonly<Record<string, string>>
    enumMode?: 'select' | 'stepper'
    multiline?: boolean
    richText?: boolean
  }
  filePath: {
    minLength?: number
    maxLength?: number
    filter?: FilePathFilter
    directoryProvider?: FilePathDirectoryProvider
  }
  anchorPosition: Record<never, never>
  alignPosition: Record<never, never>
  verticalAlignPosition: Record<never, never>
  flowDirection: Record<never, never>
  number: {
    min?: number
    max?: number
    step?: number
    allowedValues?: readonly number[]
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
  order?: number
  defaultValue?: unknown
  required?: boolean
  isHidden?: boolean
  isReadonly?: boolean
  commitMode?: 'input' | 'blur'
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
  projectIcon?: {
    provider?: PropertyCompletionProvider
    catalog?: ProjectIconCatalog
  }
  customBlock?: {
    catalog: DeepReadonly<ProjectCustomBlockCatalog>
    manifests: DeepReadonly<ProjectCustomBlockManifestCatalog>
    ensureLoaded: (key: string) => Promise<unknown>
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
  items?: readonly PropertyEditorItem[]
  addableItems?: readonly PropertyEditorAddableItem[]
  record: PropertyEditorRecord
  fields: Readonly<Record<string, PropertyEditorFieldDefinition>>
}

export type PropertyEditorItem = {
  key: string
  fieldKey: string
  title: string
  definition: PropertyEditorFieldDefinition
  value: unknown
  readonly?: boolean
  action?: OcActionDefinition
  tail?: OcActionDefinition | readonly OcItemTailPart[]
}

export type PropertyEditorAddableItem = {
  fieldKey: string
  title: string
  definition: PropertyEditorFieldDefinition
}

export function createPropertyEditorInput(input: {
  key: string
  title?: string
  record: PropertyEditorRecord
  fields: Readonly<Record<string, PropertyEditorFieldDefinition>>
}): PropertyEditorInput {
  const items = Object.keys(input.record).flatMap((fieldKey) => {
    const definition = input.fields[fieldKey]
    if (!definition) {
      if (import.meta.env.DEV) {
        console.warn(`[PropertyEditor] Missing field definition for ${input.key}.${fieldKey}`)
      }
      return []
    }
    if (definition.isHidden) return []
    return [{
      key: fieldKey,
      fieldKey,
      title: definition.title,
      definition,
      value: input.record[fieldKey],
    } satisfies PropertyEditorItem]
  })
  const addableItems = Object.entries(input.fields).flatMap(([fieldKey, definition]) => (
    definition.isHidden || Object.prototype.hasOwnProperty.call(input.record, fieldKey)
      ? []
      : [{ fieldKey, title: definition.title, definition } satisfies PropertyEditorAddableItem]
  ))
  return {
    key: input.key,
    title: input.title,
    record: input.record,
    fields: input.fields,
    items,
    addableItems,
  }
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
