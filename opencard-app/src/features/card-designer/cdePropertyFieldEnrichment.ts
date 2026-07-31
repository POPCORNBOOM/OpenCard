/** Pure helpers for projecting Card Designer fields into PropertyEditor definitions. */
import {
  exposesCardFieldReference,
  getCardFieldDefinition,
  getCardFieldKeys,
  getCardFieldValueKind,
} from '../../entities/card/model'
import type { FilePathDirectoryProvider } from '../../shared/model/filePath'
import type {
  PropertyCompletionProvider,
  PropertyEditorFieldDefinition,
} from '../../shared/ui/property-editor/propertyEditor.types'
import { chainPropertyCompletionProviders } from '../../shared/ui/property-editor/propertyCompletion'
import {
  exposesProjectFieldReference,
  getProjectFieldKeys,
  getProjectFieldValueKind,
  type ProjectFontRegistry,
  type ProjectInformation,
} from '../workspace/model/projectMetadata'
import { toCssFontFamily, type FontCatalogEntry } from '../workspace/model/projectFonts'
import {
  resolveReferenceCompletion,
  type ReferenceCompletionContext,
  type ReferenceCompletionScope,
} from '../editor-runtime/services/referenceCompletion'
import type { CdePropertyFieldDefinition } from './cdePropertyFieldDefinitions'

type Translate = (messageKey: string, parameters?: Record<string, unknown>) => string

export type CdePropertyProjectContext = {
  fonts?: ProjectFontRegistry | null
  information?: ProjectInformation | null
  dictionary?: Readonly<Record<string, string>> | null
}

export function createCdeCardReferenceScope(options: {
  label: string
  record: Readonly<Record<string, unknown>>
  translate: Translate
  hasMessage: (messageKey: string) => boolean
}): ReferenceCompletionScope {
  const additionalDefinitions = options.record.additionalFieldDefinition as
    | Readonly<Record<string, { title?: string }>>
    | undefined
  return {
    label: options.label,
    fields: getCardFieldKeys(options.record)
      .filter(fieldKey => exposesCardFieldReference(options.record, fieldKey))
      .map((fieldKey) => {
        const displayKey = getCardFieldDefinition(options.record, fieldKey)?.displayFieldKey ?? fieldKey
        const messageKey = `propertyEditor.fields.${displayKey}`
        return {
          key: fieldKey,
          label: additionalDefinitions?.[fieldKey]?.title
            ?? (options.hasMessage(messageKey) ? options.translate(messageKey) : fieldKey),
          valueKind: getCardFieldValueKind(options.record, fieldKey),
        }
      }),
  }
}

export function createCdeProjectReferenceScope(options: {
  label: string
  project: Readonly<ProjectInformation>
  translate: Translate
  hasMessage: (messageKey: string) => boolean
}): ReferenceCompletionScope {
  return {
    label: options.label,
    fields: getProjectFieldKeys(options.project)
      .filter(fieldKey => exposesProjectFieldReference(options.project, fieldKey))
      .map((fieldKey) => {
        const messageKey = `projectConfig.fields.${fieldKey}`
        return {
          key: fieldKey,
          label: options.hasMessage(messageKey) ? options.translate(messageKey) : fieldKey,
          valueKind: getProjectFieldValueKind(options.project, fieldKey),
        }
      }),
  }
}

export function createCdeDictionaryReferenceScope(
  label: string,
  dictionary: Readonly<Record<string, string>>,
): ReferenceCompletionScope {
  return {
    label,
    fields: Object.keys(dictionary).map(key => ({ key, valueKind: 'string' as const })),
  }
}

export function enrichCdePropertyFieldDefinition(options: {
  definition: CdePropertyFieldDefinition
  fieldKey: string
  record: Readonly<Record<string, unknown>>
  referenceContext?: ReferenceCompletionContext | null
  fontCatalog: readonly FontCatalogEntry[]
  directoryProvider?: FilePathDirectoryProvider
}): PropertyEditorFieldDefinition {
  const bindingProvider = options.referenceContext
    && options.definition.acceptsBinding !== false
    && options.definition.fieldType !== 'object'
    ? createReferenceCompletionProvider(options.referenceContext)
    : undefined
  const fontProvider = options.fieldKey === 'fontFamily'
    ? createFontCompletionProvider(options.fontCatalog)
    : undefined
  const provider = bindingProvider || fontProvider
    ? chainPropertyCompletionProviders([bindingProvider, fontProvider])
    : undefined
  const fontOptions = options.definition.fieldType === 'string' && options.definition.richText
    ? options.fontCatalog.map(font => ({
        label: font.label,
        value: font.value,
        cssFamily: toCssFontFamily(font.value),
      }))
    : undefined
  const richTextBaseStyle = options.definition.fieldType === 'string' && options.definition.richText
    ? {
        ...(typeof options.record.fontSize === 'string' && options.record.fontSize
          ? { fontSize: options.record.fontSize }
          : {}),
        ...(typeof options.record.fontFamily === 'string' && options.record.fontFamily
          ? { fontFamily: toCssFontFamily(options.record.fontFamily) }
          : {}),
      }
    : undefined
  const directoryProvider = options.definition.fieldType === 'filePath'
    ? options.directoryProvider
    : undefined

  if (!provider && !fontOptions && !richTextBaseStyle) return options.definition
  return {
    ...options.definition,
    ...(fontOptions ? { fontOptions } : {}),
    ...(richTextBaseStyle ? { richTextBaseStyle } : {}),
    ...(directoryProvider ? { directoryProvider } : {}),
    ...(bindingProvider ? { autoPairs: [{ open: '{{', close: '}}' }] } : {}),
    ...(bindingProvider ? { binding: { provider: bindingProvider } } : {}),
    ...(provider ? { completion: { ...options.definition.completion, provider } } : {}),
  } as PropertyEditorFieldDefinition
}

function createReferenceCompletionProvider(
  context: ReferenceCompletionContext,
): PropertyCompletionProvider {
  return ({ value, cursor }) => {
    const state = resolveReferenceCompletion(value, cursor, context)
    if (!state) return null
    return {
      replaceStart: state.replaceStart,
      replaceEnd: state.replaceEnd,
      items: state.suggestions.map(suggestion => ({
        key: suggestion.key,
        label: suggestion.label,
        detail: suggestion.detail,
        insertText: suggestion.insertText,
        keepOpen: suggestion.kind === 'scope',
        ...(suggestion.kind === 'field' ? { value: `{{${suggestion.insertText}}}` } : {}),
      })),
    }
  }
}

function createFontCompletionProvider(
  fontCatalog: readonly FontCatalogEntry[],
): PropertyCompletionProvider {
  return ({ value, cursor }) => {
    const fragment = value.slice(0, cursor).trim().toLocaleLowerCase()
    return {
      replaceStart: 0,
      replaceEnd: value.length,
      items: fontCatalog
        .filter(font => !fragment
          || font.label.toLocaleLowerCase().includes(fragment)
          || font.value.toLocaleLowerCase().includes(fragment))
        .map(font => ({
          key: `font:${font.value}`,
          label: font.label,
          detail: font.source === 'project' ? font.detail : font.value,
          insertText: font.value,
          value: font.value,
        })),
    }
  }
}
