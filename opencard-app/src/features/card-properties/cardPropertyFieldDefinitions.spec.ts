import { describe, expect, it } from 'vitest'
import { resolveCardPropertyFields } from './cardPropertyFieldDefinitions'

describe('resolveCardPropertyFields categories', () => {
  it('separates user-defined fields from advanced native fields', () => {
    const fields = resolveCardPropertyFields({
      type: 'text-block',
      score: '1',
    }, {
      allowDelete: true,
      translate: key => key,
      hasMessage: () => false,
      customKeys: new Set(['score']),
    })

    expect(fields.score?.category).toBe('customFields')
    expect(fields.customCss?.category).toBe('advanced')
  })
})
