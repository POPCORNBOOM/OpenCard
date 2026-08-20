import {
  getPropertyAllowedValues,
  type EditorPropertyDefinition,
} from './schema'

export type CardSchemaDiagnosticCode =
  | 'invalid-type'
  | 'conversion-failed'
  | 'invalid-option'
  | 'out-of-range'
  | 'required'
  | 'invalid-color'
  | 'invalid-css-length'
  | 'invalid-file-path'
  | 'invalid-object'

export type CardSchemaDiagnostic = {
  code: CardSchemaDiagnosticCode
  path: readonly (string | number)[]
}

export type CardSchemaValidationOptions = {
  cssLength?: boolean
}

export type CardSchemaValidationResult =
  | { ok: true, value: unknown, diagnostics: readonly [] }
  | { ok: false, diagnostics: readonly CardSchemaDiagnostic[] }

const cssColorFunctions = /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|var)\(.+\)$/i
const cssNamedColor = /^[a-z]+$/i
const cssHexColor = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const cssLength = /^(?:-?(?:\d+\.?\d*|\.\d+)(?:px|%|em|rem|vw|vh|vmin|vmax|cm|mm|q|in|pc|pt|ch|ex|cap|ic|lh|rlh)?|0|auto|min-content|max-content|fit-content|(?:calc|min|max|clamp|var)\(.+\))$/i

export function validateCardSchemaField(
  value: unknown,
  definition: EditorPropertyDefinition,
  options: CardSchemaValidationOptions = {},
): CardSchemaValidationResult {
  const missing = value === undefined || value === null
  const empty = value === ''
  if (definition.required && (missing || empty)) {
    return invalid('required')
  }
  if (missing) return invalid('invalid-type')

  if (definition.fieldType.endsWith('[]')) {
    if (!Array.isArray(value)) return invalid('invalid-type')
    const elementDefinition = {
      ...definition,
      fieldType: definition.fieldType.slice(0, -2),
    } as EditorPropertyDefinition
    const diagnostics = value.flatMap((item, index) => {
      const result = validateCardSchemaField(item, elementDefinition, options)
      return result.ok ? [] : result.diagnostics.map(diagnostic => ({
        ...diagnostic, path: [index, ...diagnostic.path],
      }))
    })
    if (diagnostics.length) return { ok: false, diagnostics }
    return { ok: true, value, diagnostics: [] }
  }
  let converted: unknown
  switch (definition.fieldType) {
    case 'number': {
      if (typeof value !== 'string') return invalid('invalid-type')
      const parsed = value.trim() === '' ? Number.NaN : Number(value)
      if (!Number.isFinite(parsed)) return invalid('conversion-failed')
      if ((definition.min !== undefined && parsed < definition.min)
        || (definition.max !== undefined && parsed > definition.max)) return invalid('out-of-range')
      converted = parsed
      break
    }
    case 'boolean':
      if (value !== 'true' && value !== 'false') {
        return invalid(typeof value === 'string' ? 'conversion-failed' : 'invalid-type')
      }
      converted = value === 'true'
      break
    case 'object':
      if (definition.isArray) {
        if (!Array.isArray(value)) return invalid('invalid-type')
        const diagnostics = value.flatMap((item, index) => validateObjectType(item, definition.objectType)
          ? [] : [{ code: 'invalid-object' as const, path: [index] }])
        if (diagnostics.length) return { ok: false, diagnostics }
      } else if (!isRecord(value)) {
        return invalid('invalid-type')
      } else if (!validateObjectType(value, definition.objectType)) {
        return invalid('invalid-object')
      }
      converted = value
      break
    default: {
      const stringValue = options.cssLength && typeof value === 'number' && Number.isFinite(value)
        ? String(value)
        : value
      if (typeof stringValue !== 'string') return invalid('invalid-type')
      if ('minLength' in definition && definition.minLength !== undefined && stringValue.length < definition.minLength) {
        return invalid('out-of-range')
      }
      if ('maxLength' in definition && definition.maxLength !== undefined && stringValue.length > definition.maxLength) {
        return invalid('out-of-range')
      }
      if (definition.fieldType === 'color' && stringValue && !isCssColor(stringValue)) return invalid('invalid-color')
      if (definition.fieldType === 'filePath' && stringValue && !isValidFilePath(stringValue, definition.filter?.extensions)) {
        return invalid('invalid-file-path')
      }
      if (options.cssLength && stringValue) {
        const normalized = normalizeCssLength(stringValue)
        if (!isCssLength(normalized)) return invalid('invalid-css-length')
        converted = normalized
        break
      }
      converted = stringValue
    }
  }

  const allowed = getPropertyAllowedValues(definition)
  if (allowed && (typeof converted !== 'string' || !allowed.includes(converted))) return invalid('invalid-option')
  return { ok: true, value: converted, diagnostics: [] }
}

export function isCssColor(value: string): boolean {
  const candidate = value.trim()
  if (!candidate) return true
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', candidate)
  }
  return cssHexColor.test(candidate)
    || cssColorFunctions.test(candidate)
    || cssNamedColor.test(candidate)
    || candidate === 'transparent'
    || candidate === 'currentColor'
}

export function normalizeCssLength(value: string): string {
  const trimmed = value.trim()
  if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return `${trimmed}px`
  if (/^calc\(.+\)$/i.test(trimmed)) return trimmed
  if (/\S\s+[+\-*/]\s+\S/.test(trimmed)) return `calc(${trimmed})`
  return trimmed
}

export function isCssLength(value: string): boolean {
  const candidate = value.trim()
  if (!candidate) return true
  if (/\S\s+[+\-*/]\s+\S/.test(candidate)) return true
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('width', candidate)
  }
  return cssLength.test(candidate)
}

function isValidFilePath(value: string, extensions?: readonly string[]): boolean {
  const normalized = value.replace(/\\/g, '/')
  if (normalized.includes('\0') || /(^|\/)\.\.(?:\/|$)/.test(normalized) || /[<>:"|?*]/.test(normalized)) return false
  if (!extensions?.length || normalized.endsWith('/')) return true
  const extension = normalized.split('.').pop()?.toLocaleLowerCase()
  return Boolean(extension && extensions.some(candidate => candidate.toLocaleLowerCase() === extension))
}

function validateObjectType(value: unknown, objectType: string): boolean {
  if (!isRecord(value)) return false
  switch (objectType) {
    case 'CardFace':
      return value.type === 'card-face' && typeof value.id === 'string'
    case 'CardInstanceRecord':
      return value.type === 'card-instance' && typeof value.id === 'string'
    case 'RootChild':
      return isRecord(value.block) && isRecord(value.location)
    case 'CardBlock':
      return (typeof value.type === 'string' && typeof value.id === 'string')
        || (isRecord(value.block) && isRecord(value.location))
    case 'CardDataTableConfiguration':
      return value.blocks === undefined || isRecord(value.blocks)
    case 'AdditionalFieldDefinition':
      return Object.values(value).every(item => isRecord(item) && typeof item.fieldType === 'string')
    case 'instanceData':
      return Object.values(value).every(isRecord)
    default:
      return true
  }
}

function invalid(code: CardSchemaDiagnosticCode): CardSchemaValidationResult {
  return { ok: false, diagnostics: [{ code, path: [] }] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
