import {
  getTypePropertyEditorSchema,
  isReferenceFieldReadable,
} from '../../../entities/card/schema'

export type ReferenceCompletionScope = {
  token: string
  label: string
  typeName: string
  record: Record<string, unknown>
}

export type ReferenceCompletionContext = {
  scopes: ReferenceCompletionScope[]
}

export type ReferenceCompletionSuggestion = {
  key: string
  label: string
  detail: string
  insertText: string
  kind: 'scope' | 'field'
}

export type ReferenceCompletionState = {
  replaceStart: number
  replaceEnd: number
  suggestions: ReferenceCompletionSuggestion[]
}

export type ReferenceCompletionEdit = {
  value: string
  cursor: number
}

export function resolveReferenceCompletion(
  value: string,
  cursor: number,
  context: ReferenceCompletionContext | null | undefined,
): ReferenceCompletionState | null {
  if (!context || cursor < 2) {
    return null
  }

  const tokenStart = value.lastIndexOf('{{', cursor - 1)
  if (tokenStart < 0) {
    return null
  }

  const tokenBodyStart = tokenStart + 2
  const tokenBody = value.slice(tokenBodyStart, cursor)
  if (tokenBody.includes('{') || tokenBody.includes('}')) {
    return null
  }

  const colonIndex = tokenBody.indexOf(':')
  if (colonIndex < 0) {
    const fragment = tokenBody.trim().toLowerCase()
    const suggestions = context.scopes
      .filter((scope) => scope.token.toLowerCase().startsWith(fragment))
      .map((scope) => ({
        key: `scope:${scope.token}`,
        label: `${scope.token}:`,
        detail: scope.label,
        insertText: `${scope.token}:`,
        kind: 'scope' as const,
      }))

    return {
      replaceStart: tokenBodyStart,
      replaceEnd: cursor,
      suggestions,
    }
  }

  const scopeToken = tokenBody.slice(0, colonIndex).trim()
  const scope = context.scopes.find((item) => item.token === scopeToken)
  if (!scope) {
    return null
  }

  const fieldFragment = tokenBody.slice(colonIndex + 1).trim().toLowerCase()
  const schema = getTypePropertyEditorSchema(scope.typeName)
  const fieldKeys = Array.from(new Set([
    ...Object.keys(scope.record),
    ...Object.keys(schema).filter((fieldKey) => Object.prototype.hasOwnProperty.call(scope.record, fieldKey)),
  ]))

  const suggestions = fieldKeys
    .filter((fieldKey) => isReferenceFieldReadable(scope.typeName, fieldKey))
    .filter((fieldKey) => fieldKey.toLowerCase().includes(fieldFragment))
    .sort((left, right) => {
      const leftStartsWith = left.toLowerCase().startsWith(fieldFragment)
      const rightStartsWith = right.toLowerCase().startsWith(fieldFragment)
      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1
      }
      return left.localeCompare(right, undefined, { sensitivity: 'base' })
    })
    .map((fieldKey) => ({
      key: `field:${scope.token}:${fieldKey}`,
      label: fieldKey,
      detail: scope.label,
      insertText: `${scope.token}:${fieldKey}`,
      kind: 'field' as const,
    }))

  return {
    replaceStart: tokenBodyStart,
    replaceEnd: cursor,
    suggestions,
  }
}

export function applyReferenceCompletion(
  value: string,
  state: ReferenceCompletionState,
  suggestion: ReferenceCompletionSuggestion,
): ReferenceCompletionEdit {
  const nextValue = `${value.slice(0, state.replaceStart)}${suggestion.insertText}${value.slice(state.replaceEnd)}`
  return {
    value: nextValue,
    cursor: state.replaceStart + suggestion.insertText.length,
  }
}
