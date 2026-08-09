import { describe, expect, it } from 'vitest'
import { resolveCdePropertyFields } from './cdePropertyFieldDefinitions'

describe('resolveCdePropertyFields categories', () => {
  it('separates user-defined fields from advanced native fields', () => {
    const fields = resolveCdePropertyFields({
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
