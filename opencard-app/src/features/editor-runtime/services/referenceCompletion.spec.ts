import { describe, expect, it } from 'vitest'
import {
  applyReferenceCompletion,
  resolveReferenceCompletion,
  type ReferenceCompletionContext,
} from './referenceCompletion'

const context: ReferenceCompletionContext = {
  scopes: [
    {
      token: 'c',
      label: '当前卡片',
      typeName: 'card-instance',
      record: {
        type: 'card-instance',
        id: 'instance-1',
        name: 'Card A',
        amount: 2,
        data: {},
      },
    },
    {
      token: 'd',
      label: '当前文档',
      typeName: 'card-document',
      record: {
        type: 'card-document',
        id: 'document-1',
        name: 'Document A',
      },
    },
  ],
}

describe('referenceCompletion', () => {
  it('suggests scopes inside a newly opened reference token', () => {
    const state = resolveReferenceCompletion('{{}}', 2, context)

    expect(state?.suggestions.map((suggestion) => suggestion.insertText)).toEqual([
      'c:',
      'd:',
    ])
  })

  it('suggests only readable fields from the selected scope', () => {
    const state = resolveReferenceCompletion('{{c:na}}', 6, context)

    expect(state?.suggestions.map((suggestion) => suggestion.insertText)).toEqual([
      'c:name',
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
