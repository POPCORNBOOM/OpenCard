import { isBindingCompatible, type BindingValueKind } from '../model/binding'
import {
  findActiveBindingToken,
  formatBindingScopeToken,
  parseBindingScopeToken,
  type BindingScopeDescriptor,
} from '../model/bindingExpression'

export type ReferenceCompletionField = {
  key: string
  label?: string
  valueKind: BindingValueKind
}

export type ReferenceCompletionScope = {
  label: string
  fields: readonly ReferenceCompletionField[]
}

export type ReferenceCompletionContext = {
  targetKind: BindingValueKind
  currentBlock?: ReferenceCompletionScope
  currentCard?: ReferenceCompletionScope
  document?: ReferenceCompletionScope
  project?: ReferenceCompletionScope
  getAncestor: (depth: number) => ReferenceCompletionScope | undefined
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
  if (!context) return null
  const active = findActiveBindingToken(value, cursor)
  if (!active) return null

  const colonIndex = active.body.indexOf(':')
  if (colonIndex >= 0) {
    return resolveFieldSuggestions(active, colonIndex, context)
  }

  return {
    replaceStart: active.bodyStart,
    replaceEnd: cursor,
    suggestions: resolveScopeSuggestions(active.body.trim(), context),
  }
}

function resolveScopeSuggestions(
  fragmentInput: string,
  context: ReferenceCompletionContext,
): ReferenceCompletionSuggestion[] {
  const fragment = fragmentInput.toLocaleLowerCase()
  if (fragment.startsWith('p')) {
    return resolveParentScopeSuggestions(fragment, context)
  }

  const fixedScopes: Array<readonly [string, ReferenceCompletionScope | undefined]> = [
    ['s', context.currentBlock],
    ['c', context.currentCard],
    ['d', context.document],
    ['g', context.project],
  ]
  const suggestions = fixedScopes
    .filter(([token, scope]) => scope && token.startsWith(fragment) && hasCompatibleField(scope, context.targetKind))
    .map(([token, scope]) => scopeSuggestion(`${token}:`, scope!.label))

  const parent = context.getAncestor(1)
  if (parent && 'p'.startsWith(fragment) && hasCompatibleField(parent, context.targetKind)) {
    suggestions.push(scopeSuggestion('p:', parent.label))
  }
  return suggestions
}

function resolveParentScopeSuggestions(
  fragment: string,
  context: ReferenceCompletionContext,
): ReferenceCompletionSuggestion[] {
  if (!/^p(?:\.p)*\.?$/i.test(fragment)) return []
  const completedDepth = fragment.split('.').filter(Boolean).length
  const targetDepth = fragment.endsWith('.') ? completedDepth + 1 : completedDepth
  const scope = context.getAncestor(targetDepth)
  if (!scope || !hasCompatibleField(scope, context.targetKind)) return []

  const token = Array.from({ length: targetDepth }, () => 'p').join('.')
  const suggestions = [scopeSuggestion(`${token}:`, scope.label)]
  if (context.getAncestor(targetDepth + 1)) {
    suggestions.push(scopeSuggestion(`${token}.`, scope.label))
  }
  return suggestions
}

function resolveFieldSuggestions(
  active: NonNullable<ReturnType<typeof findActiveBindingToken>>,
  colonIndex: number,
  context: ReferenceCompletionContext,
): ReferenceCompletionState | null {
  const scopeDescriptor = parseBindingScopeToken(active.body.slice(0, colonIndex))
  const scope = scopeDescriptor ? resolveScope(scopeDescriptor, context) : undefined
  if (!scope) return null

  const scopeToken = formatBindingScopeToken(scopeDescriptor!)
  const fragment = active.body.slice(colonIndex + 1).trim().toLocaleLowerCase()
  const suggestions = scope.fields
    .filter((field) => isBindingCompatible(context.targetKind, field.valueKind))
    .filter((field) => field.key.toLocaleLowerCase().includes(fragment)
      || field.label?.toLocaleLowerCase().includes(fragment))
    .sort((left, right) => {
      const leftStarts = left.key.toLocaleLowerCase().startsWith(fragment)
      const rightStarts = right.key.toLocaleLowerCase().startsWith(fragment)
      if (leftStarts !== rightStarts) return leftStarts ? -1 : 1
      return left.key.localeCompare(right.key, undefined, { sensitivity: 'base' })
    })
    .map((field) => ({
      key: `field:${scopeToken}:${field.key}`,
      label: field.label ?? field.key,
      detail: scope.label,
      insertText: `${scopeToken}:${field.key}`,
      kind: 'field' as const,
      valueKind: field.valueKind,
    }))

  return {
    replaceStart: active.bodyStart,
    replaceEnd: active.cursor,
    suggestions,
  }
}

function resolveScope(
  descriptor: BindingScopeDescriptor,
  context: ReferenceCompletionContext,
): ReferenceCompletionScope | undefined {
  if (descriptor.kind === 'current-block') return context.currentBlock
  if (descriptor.kind === 'current-card') return context.currentCard
  if (descriptor.kind === 'document') return context.document
  if (descriptor.kind === 'project') return context.project
  return context.getAncestor(descriptor.parentDepth)
}

function hasCompatibleField(scope: ReferenceCompletionScope, targetKind: BindingValueKind): boolean {
  return scope.fields.some((field) => isBindingCompatible(targetKind, field.valueKind))
}

function scopeSuggestion(insertText: string, detail: string): ReferenceCompletionSuggestion {
  return {
    key: `scope:${insertText}`,
    label: insertText,
    detail,
    insertText,
    kind: 'scope',
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
