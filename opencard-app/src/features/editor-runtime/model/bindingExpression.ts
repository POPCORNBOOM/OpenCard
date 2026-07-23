export type BindingScopeKind =
  | 'current-block'
  | 'current-card'
  | 'current-face'
  | 'opposite-face'
  | 'document'
  | 'project'
  | 'parent'

export type BindingScopeDescriptor =
  | { kind: 'current-block' }
  | { kind: 'current-card' }
  | { kind: 'current-face' }
  | { kind: 'opposite-face' }
  | { kind: 'document' }
  | { kind: 'project' }
  | { kind: 'parent'; parentDepth: number }

export type FieldReferenceDescriptor = BindingScopeDescriptor & {
  fieldKey: string
}

export type ActiveBindingToken = {
  body: string
  bodyStart: number
  cursor: number
}

const parentScopePattern = /^p(?:\.p)*$/i

export function parseBindingScopeToken(token: string): BindingScopeDescriptor | null {
  const normalized = token.trim().toLocaleLowerCase()
  if (normalized === 's') return { kind: 'current-block' }
  if (normalized === 'c') return { kind: 'current-card' }
  if (normalized === 'f') return { kind: 'current-face' }
  if (normalized === 'o') return { kind: 'opposite-face' }
  if (normalized === 'd') return { kind: 'document' }
  if (normalized === 'g') return { kind: 'project' }
  if (!parentScopePattern.test(normalized)) return null
  return { kind: 'parent', parentDepth: normalized.split('.').length }
}

export function parseFieldReference(reference: string): FieldReferenceDescriptor | null {
  const normalized = reference.trim()
  const colonIndex = normalized.indexOf(':')
  if (colonIndex < 1 || normalized.indexOf(':', colonIndex + 1) >= 0) return null
  const scope = parseBindingScopeToken(normalized.slice(0, colonIndex))
  const fieldKey = normalized.slice(colonIndex + 1).trim()
  return scope && fieldKey ? { ...scope, fieldKey } : null
}

export function findActiveBindingToken(value: string, cursor: number): ActiveBindingToken | null {
  if (cursor < 2) return null
  const tokenStart = value.lastIndexOf('{{', cursor - 1)
  if (tokenStart < 0) return null
  const bodyStart = tokenStart + 2
  const body = value.slice(bodyStart, cursor)
  if (body.includes('{') || body.includes('}')) return null
  return { body, bodyStart, cursor }
}

export function formatBindingScopeToken(scope: BindingScopeDescriptor): string {
  if (scope.kind === 'current-block') return 's'
  if (scope.kind === 'current-card') return 'c'
  if (scope.kind === 'current-face') return 'f'
  if (scope.kind === 'opposite-face') return 'o'
  if (scope.kind === 'document') return 'd'
  if (scope.kind === 'project') return 'g'
  return Array.from({ length: scope.parentDepth }, () => 'p').join('.')
}
