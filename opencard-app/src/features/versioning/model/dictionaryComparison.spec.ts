import { describe, expect, it } from 'vitest'
import { dictionaryComparisonCellIdentity, projectDictionaryComparison } from './dictionaryComparison'

describe('projectDictionaryComparison', () => {
  const historical = {
    active: 'en-US',
    base: { title: 'Old title', removed: 'Removed' },
    languages: { 'en-US': { title: 'Old English' }, ja: { title: '古い' } },
  }
  const current = {
    active: 'ja',
    base: { title: 'New title', added: 'Added' },
    languages: { 'en-us': { title: 'New English' }, fr: { title: 'Nouveau' }, ja: { title: '古い' } },
  }

  it('uses current ordering and preserves side-local direct values', () => {
    const oldSide = projectDictionaryComparison(historical, current, 'historical')!
    const newSide = projectDictionaryComparison(historical, current, 'current')!

    expect(Object.keys(oldSide.dictionary.base!)).toEqual(['title', 'removed', 'added'])
    expect(Object.keys(newSide.dictionary.base!)).toEqual(['title', 'removed', 'added'])
    expect(Object.keys(oldSide.dictionary.languages!)).toEqual(['en-us', 'fr', 'ja'])
    expect(oldSide.dictionary.base).toEqual({ title: 'Old title', removed: 'Removed', added: '' })
    expect(newSide.dictionary.base).toEqual({ title: 'New title', removed: '', added: 'Added' })
    expect(oldSide.missingRecords).toEqual(new Set(['added']))
    expect(newSide.missingRecords).toEqual(new Set(['removed']))
    expect(oldSide.missingLanguages).toEqual(new Set(['fr']))
  })

  it('marks only direct stored cell and key changes', () => {
    const projection = projectDictionaryComparison(historical, current, 'current')!

    expect(projection.changedCells).toContain(dictionaryComparisonCellIdentity('title', '$base'))
    expect(projection.changedCells).toContain(dictionaryComparisonCellIdentity('title', 'en-us'))
    expect(projection.changedCells).not.toContain(dictionaryComparisonCellIdentity('title', 'ja'))
    expect(projection.changedLanguageKeys).toContain('en-us')
    expect(projection.activeChanged).toBe(true)
  })
})
