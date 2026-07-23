import { describe, expect, it } from 'vitest'
import {
  applyReferenceCompletion,
  resolveReferenceCompletion,
  type ReferenceCompletionContext,
} from './referenceCompletion'

const parentScopes = [
  { label: '父容器', fields: [{ key: 'width', valueKind: 'string' as const }] },
  { label: '祖父容器', fields: [{ key: 'width', valueKind: 'string' as const }] },
  { label: '三级祖先', fields: [{ key: 'name', valueKind: 'string' as const }] },
]
const context: ReferenceCompletionContext = {
  targetKind: 'string',
  currentBlock: { label: '当前块', fields: [{ key: 'title', valueKind: 'string' }] },
  currentCard: {
    label: '当前卡片',
    fields: [
      { key: 'name', valueKind: 'string' },
      { key: 'amount', valueKind: 'number' },
    ],
  },
  currentFace: { label: '同面', fields: [{ key: 'background', valueKind: 'string' }] },
  oppositeFace: { label: '异面', fields: [{ key: 'background', valueKind: 'string' }] },
  document: { label: '当前文档', fields: [{ key: 'name', valueKind: 'string' }] },
  project: { label: '当前项目', fields: [{ key: 'author', valueKind: 'string' }] },
  getAncestor: (depth) => parentScopes[depth - 1],
}

describe('referenceCompletion', () => {
  it('suggests root scopes without pre-generating every ancestor token', () => {
    expect(resolveReferenceCompletion('{{}}', 2, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['s:', 'c:', 'f:', 'o:', 'd:', 'g:', 'p:'])
  })

  it('offers field selection and continuation for parent chains', () => {
    expect(resolveReferenceCompletion('{{p}}', 3, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['p:', 'p.'])
    expect(resolveReferenceCompletion('{{p.}}', 4, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['p.p:', 'p.p.'])
    expect(resolveReferenceCompletion('{{p.p:wi}}', 8, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['p.p:width'])
  })

  it('matches fixed scopes case-insensitively and filters by target kind', () => {
    const numberContext: ReferenceCompletionContext = { ...context, targetKind: 'number' }
    expect(resolveReferenceCompletion('{{C:}}', 4, numberContext)?.suggestions.map((item) => item.insertText))
      .toEqual(['c:amount'])
  })

  it('offers fields from the project scope', () => {
    expect(resolveReferenceCompletion('{{G:au}}', 6, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['g:author'])
  })

  it('restricts completion to explicitly allowed scopes', () => {
    const projectOnlyContext: ReferenceCompletionContext = {
      ...context,
      allowedScopes: ['project'],
    }
    expect(resolveReferenceCompletion('{{}}', 2, projectOnlyContext)?.suggestions.map((item) => item.insertText))
      .toEqual(['g:'])
    expect(resolveReferenceCompletion('{{d:}}', 4, projectOnlyContext)).toBeNull()
    expect(resolveReferenceCompletion('{{g:}}', 4, projectOnlyContext)?.suggestions.map((item) => item.insertText))
      .toEqual(['g:author'])
  })

  it('offers same-face and opposite-face fields', () => {
    expect(resolveReferenceCompletion('{{f:ba}}', 6, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['f:background'])
    expect(resolveReferenceCompletion('{{o:ba}}', 6, context)?.suggestions.map((item) => item.insertText))
      .toEqual(['o:background'])
  })

  it('replaces only the token body and preserves closing braces', () => {
    const state = resolveReferenceCompletion('Name: {{c:n}}', 11, context)!
    expect(applyReferenceCompletion('Name: {{c:n}}', state, state.suggestions[0]!)).toEqual({
      value: 'Name: {{c:name}}',
      cursor: 14,
    })
  })
})
