import { isBindingCompatible, type BindingValueKind } from '../model/binding'

export type ReferenceCompletionField = {
  key: string
  label?: string
  valueKind: BindingValueKind
}

export type ReferenceCompletionScope = {
  token: string
  label: string
  fields: readonly ReferenceCompletionField[]
}

export type ReferenceCompletionContext = {
  scopes: readonly ReferenceCompletionScope[]
  targetKind: BindingValueKind
}

export type ReferenceCompletionSuggestion = {
  key: string
  label: string
  detail: string
  insertText: string
  kind: 'scope' | 'field'
  valueKind?: BindingValueKind
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
      .filter((scope) => scope.fields.some((field) => isBindingCompatible(context.targetKind, field.valueKind)))
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
  const scope = context.scopes.find((item) => item.token.toLowerCase() === scopeToken.toLowerCase())
  if (!scope) {
    return null
  }

  const fieldFragment = tokenBody.slice(colonIndex + 1).trim().toLowerCase()
  const suggestions = scope.fields
    .filter((field) => isBindingCompatible(context.targetKind, field.valueKind))
    .filter((field) => field.key.toLowerCase().includes(fieldFragment)
      || field.label?.toLowerCase().includes(fieldFragment))
    .sort((left, right) => {
      const leftStartsWith = left.key.toLowerCase().startsWith(fieldFragment)
      const rightStartsWith = right.key.toLowerCase().startsWith(fieldFragment)
      if (leftStartsWith !== rightStartsWith) {
        return leftStartsWith ? -1 : 1
      }
      return left.key.localeCompare(right.key, undefined, { sensitivity: 'base' })
    })
    .map((field) => ({
      key: `field:${scope.token}:${field.key}`,
      label: field.label ?? field.key,
      detail: scope.label,
      insertText: `${scope.token}:${field.key}`,
      kind: 'field' as const,
      valueKind: field.valueKind,
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
