import { describe, expect, it } from 'vitest'
import {
  applyReferenceCompletion,
  resolveReferenceCompletion,
  type ReferenceCompletionContext,
} from './referenceCompletion'

const context: ReferenceCompletionContext = {
  targetKind: 'string',
  scopes: [
    {
      token: 's',
      label: '当前块',
      fields: [{ key: 'title', valueKind: 'string' }],
    },
    {
      token: 'c',
      label: '当前卡片',
      fields: [
        { key: 'name', valueKind: 'string' },
        { key: 'amount', valueKind: 'number' },
      ],
    },
    {
      token: 'd',
      label: '当前文档',
      fields: [{ key: 'name', valueKind: 'string' }],
    },
    {
      token: 'p',
      label: '父容器',
      fields: [{ key: 'name', valueKind: 'string' }],
    },
    {
      token: 'p.p',
      label: '祖父容器',
      fields: [{ key: 'name', valueKind: 'string' }],
    },
  ],
}

describe('referenceCompletion', () => {
  it('suggests scopes inside a newly opened reference token', () => {
    const state = resolveReferenceCompletion('{{}}', 2, context)

    expect(state?.suggestions.map((suggestion) => suggestion.insertText)).toEqual([
      's:',
      'c:',
      'd:',
      'p:',
      'p.p:',
    ])
  })

  it('suggests only readable fields from the selected scope', () => {
    const state = resolveReferenceCompletion('{{c:na}}', 6, context)

    expect(state?.suggestions.map((suggestion) => suggestion.insertText)).toEqual([
      'c:name',
    ])
  })

  it('matches scope tokens case-insensitively and filters by target kind', () => {
    const numberContext: ReferenceCompletionContext = { ...context, targetKind: 'number' }
    const state = resolveReferenceCompletion('{{C:}}', 4, numberContext)

    expect(state?.suggestions.map((suggestion) => suggestion.insertText)).toEqual([
      'c:amount',
    ])
  })

  it('replaces only the token body and preserves closing braces', () => {
    const state = resolveReferenceCompletion('Name: {{c:n}}', 11, context)
    const suggestion = state?.suggestions[0]

    expect(state).not.toBeNull()
    expect(suggestion).toBeDefined()
    expect(applyReferenceCompletion('Name: {{c:n}}', state!, suggestion!)).toEqual({
      value: 'Name: {{c:name}}',
      cursor: 14,
    })
  })
})
